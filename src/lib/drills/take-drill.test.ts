import { describe, expect, it } from "vitest";
import { FakeLlmPort } from "@/lib/llm/fake-port";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { submitAttempt } from "@/lib/study/submit-attempt";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";
import { FakeDrillsRepository } from "./fake-repository";
import { loadDrill } from "./load-drill";
import { startDueDrill } from "./start-due-drill";

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

    const loadProgress = async () => {
      const loaded = await loadDrill({ drillsRepo, questionsRepo }, drill.id);
      if (!loaded) {
        throw new Error("the Drill just started should be loadable");
      }
      return loaded.progress;
    };

    const startedAt = Date.now();
    let progress = await loadProgress();
    expect(progress.completed).toBe(false);

    while (progress.currentQuestion) {
      const question = progress.currentQuestion;
      await submitAttempt(
        { questionsRepo, syllabusRepo, llmPort },
        {
          questionId: question.id,
          confidence: "confident",
          submittedAnswer: question.type === "recall" ? "An answer." : undefined,
          selectedOptionIndex: question.type === "flashcard" ? 0 : undefined,
        },
      );

      progress = await loadProgress();
    }

    expect(progress.completed).toBe(true);
    expect(progress.summary.total).toBeGreaterThan(0);
    expect(progress.summary.correct).toBe(progress.summary.total);

    const questions = await questionsRepo.listDrillQuestions(drill.id);
    for (const conceptId of conceptIds) {
      const concept = await syllabusRepo.getConcept(conceptId);
      expect(concept?.nextReviewDueAt).toBeTruthy();
      expect(new Date(concept?.nextReviewDueAt ?? 0).getTime()).toBeGreaterThan(startedAt);

      // Both Concepts were newly studied, so each was asked twice — but one
      // Drill is one review, so the interval is what a single
      // correct-and-confident Attempt earns, not that compounded twice.
      expect(questions.filter((question) => question.conceptIds.includes(conceptId))).toHaveLength(2);
      expect(concept?.reviewIntervalDays).toBe(3);
    }
  });
});
