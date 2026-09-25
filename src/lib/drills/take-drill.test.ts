import { describe, expect, it } from "vitest";
import { FakeLlmPort } from "@/lib/llm/fake-port";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { gradeAttempt, submitAttempt } from "@/lib/study/submit-attempt";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";
import { FakeDrillsRepository } from "./fake-repository";
import { loadDrill } from "./load-drill";
import { startDueDrill } from "./start-due-drill";
import { startRandomDrill } from "./start-random-drill";

type Deps = {
  syllabusRepo: FakeSyllabusRepository;
  drillsRepo: FakeDrillsRepository;
  questionsRepo: FakeQuestionsRepository;
  llmPort: FakeLlmPort;
};

function buildDeps(): Deps {
  return {
    syllabusRepo: new FakeSyllabusRepository(),
    drillsRepo: new FakeDrillsRepository(),
    questionsRepo: new FakeQuestionsRepository(),
    llmPort: new FakeLlmPort(),
  };
}

/** Answers every Question of the Drill correctly and confidently, in order. */
async function workThrough(deps: Deps, drillId: string) {
  const { drillsRepo, questionsRepo, syllabusRepo, llmPort } = deps;
  const loadProgress = async () => {
    const loaded = await loadDrill({ drillsRepo, questionsRepo }, drillId);
    if (!loaded) {
      throw new Error("the Drill just started should be loadable");
    }
    return loaded.progress;
  };

  let progress = await loadProgress();
  expect(progress.completed).toBe(false);

  while (progress.currentQuestion) {
    const question = progress.currentQuestion;
    const attempt = await submitAttempt(
      { questionsRepo, syllabusRepo },
      {
        questionId: question.id,
        confidence: "confident",
        submittedAnswer: question.type === "flashcard" ? undefined : "An answer.",
        selectedOptionIndex: question.type === "flashcard" ? 0 : undefined,
      },
    );
    // As the attempts route does once it has responded.
    if (attempt.gradingStatus === "pending") {
      await gradeAttempt({ questionsRepo, syllabusRepo, llmPort }, attempt.id);
    }

    progress = await loadProgress();
  }
  return progress;
}

describe("taking a Drill", () => {
  it("updates each answered Concept's review schedule as the Drill is worked through", async () => {
    const syllabusRepo = new FakeSyllabusRepository();
    const drillsRepo = new FakeDrillsRepository();
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort();

    const domain = await syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const conceptIds: string[] = [];
    for (const name of ["Idempotency", "Backpressure"]) {
      const concept = await syllabusRepo.createConcept(subject.id, { name });
      await syllabusRepo.setConceptStatus(concept.id, "studied");
      conceptIds.push(concept.id);
    }

    const drill = await startDueDrill(
      { syllabusRepo, drillsRepo, questionsRepo, llmPort },
      { domainId: domain.id },
    );

    const startedAt = Date.now();
    const progress = await workThrough({ drillsRepo, questionsRepo, syllabusRepo, llmPort }, drill.id);

    expect(progress.completed).toBe(true);
    expect(progress.summary.total).toBeGreaterThan(0);
    expect(progress.summary.correct).toBe(progress.summary.total);

    const questions = await questionsRepo.listDrillQuestions(drill.id);
    for (const conceptId of conceptIds) {
      const concept = await syllabusRepo.getConcept(conceptId);
      expect(concept?.nextReviewDueAt).toBeTruthy();
      expect(new Date(concept?.nextReviewDueAt ?? 0).getTime()).toBeGreaterThan(startedAt);

      // Both Concepts were newly studied, so each was asked a recall and a
      // flashcard, and met again in the scenario — but one Drill is one
      // review, so the interval is what a single correct-and-confident
      // Attempt earns, not that compounded three times.
      expect(questions.filter((question) => question.conceptIds.includes(conceptId))).toHaveLength(3);
      expect(concept?.reviewIntervalDays).toBe(3);
    }
  });

  it("schedules every Concept a random Drill touched exactly as a due Drill would", async () => {
    /** The same library in each world, every Concept due now at a different strength. */
    async function buildLibrary(syllabusRepo: FakeSyllabusRepository) {
      const domain = await syllabusRepo.createDomain({ name: "Software Engineering" });
      const systemDesign = await syllabusRepo.createSubject(domain.id, { name: "System Design" });
      const apiDesign = await syllabusRepo.createSubject(domain.id, { name: "API Design" });
      const concepts = [
        { subjectId: systemDesign.id, name: "Idempotency", schedule: null },
        { subjectId: systemDesign.id, name: "Caching", schedule: { intervalDays: 6, easeFactor: 2.5 } },
        { subjectId: apiDesign.id, name: "Pagination", schedule: { intervalDays: 30, easeFactor: 2.8 } },
      ];
      for (const { subjectId, name, schedule } of concepts) {
        const concept = await syllabusRepo.createConcept(subjectId, { name });
        await syllabusRepo.setConceptStatus(concept.id, "studied");
        if (schedule) {
          await syllabusRepo.updateConceptReviewSchedule(concept.id, {
            ...schedule,
            nextDueAt: new Date().toISOString(),
          });
        }
      }
      return domain;
    }

    async function schedulesByName(syllabusRepo: FakeSyllabusRepository, domainId: string) {
      const schedules: Record<string, [number | null, number | null]> = {};
      for (const subject of await syllabusRepo.listSubjects(domainId)) {
        for (const concept of await syllabusRepo.listConcepts(subject.id)) {
          schedules[concept.name] = [concept.reviewIntervalDays, concept.reviewEaseFactor];
        }
      }
      return schedules;
    }

    const due = buildDeps();
    const dueDomain = await buildLibrary(due.syllabusRepo);
    const before = await schedulesByName(due.syllabusRepo, dueDomain.id);
    const dueDrill = await startDueDrill(due, { domainId: dueDomain.id });
    await workThrough(due, dueDrill.id);

    const random = buildDeps();
    const randomDomain = await buildLibrary(random.syllabusRepo);
    const randomDrill = await startRandomDrill(random, { scope: { kind: "library" } });
    const progress = await workThrough(random, randomDrill.id);

    expect(progress.completed).toBe(true);
    const after = await schedulesByName(random.syllabusRepo, randomDomain.id);
    expect(after).toEqual(await schedulesByName(due.syllabusRepo, dueDomain.id));
    for (const name of Object.keys(before)) {
      expect(after[name]).not.toEqual(before[name]);
    }
  });
});
