import { describe, expect, it, vi } from "vitest";
import { FakeLlmPort } from "@/lib/llm/fake-port";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { NotFoundError } from "@/lib/syllabus/errors";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";
import { FakeDrillsRepository } from "./fake-repository";
import { DrillGenerationError, NoDueConceptsError } from "./errors";
import { startDueDrill } from "./start-due-drill";

const FAR_FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

function buildDeps() {
  return {
    syllabusRepo: new FakeSyllabusRepository(),
    drillsRepo: new FakeDrillsRepository(),
    questionsRepo: new FakeQuestionsRepository(),
    llmPort: new FakeLlmPort(),
  };
}

async function studyConcept(
  syllabusRepo: FakeSyllabusRepository,
  subjectId: string,
  name: string,
  schedule?: { intervalDays: number; easeFactor: number; nextDueAt?: string },
) {
  const concept = await syllabusRepo.createConcept(subjectId, { name });
  await syllabusRepo.setConceptStatus(concept.id, "studied");
  if (schedule) {
    await syllabusRepo.updateConceptReviewSchedule(concept.id, {
      intervalDays: schedule.intervalDays,
      easeFactor: schedule.easeFactor,
      nextDueAt: schedule.nextDueAt ?? new Date().toISOString(),
    });
  }
  return concept;
}

describe("startDueDrill", () => {
  it("creates a due-scoped Drill whose Questions cover the due Concepts in order", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const weak = await studyConcept(deps.syllabusRepo, subject.id, "Idempotency");
    const strong = await studyConcept(deps.syllabusRepo, subject.id, "Caching", {
      intervalDays: 40,
      easeFactor: 2.8,
    });

    const drill = await startDueDrill(deps, { domainId: domain.id });

    expect(drill.domainId).toBe(domain.id);
    expect(drill.scope).toBe("due");
    expect(drill.scopeDetail).toEqual({ dueAsOf: expect.any(String) });
    expect(await deps.drillsRepo.getDrill(drill.id)).toEqual(drill);

    const questions = await deps.questionsRepo.listDrillQuestions(drill.id);
    expect(questions.map((question) => [question.conceptIds, question.type])).toEqual([
      [[weak.id], "recall"],
      [[weak.id], "flashcard"],
      [[strong.id], "flashcard"],
      [[weak.id, strong.id], "scenario"],
    ]);
    expect(questions.map((question) => question.position)).toEqual([0, 1, 2, 3]);
    expect(questions[0].prompt).toContain("Idempotency");
    expect(questions[1].options?.length).toBeGreaterThan(1);
  });

  it("never includes Concepts from another Domain", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const inDomain = await studyConcept(deps.syllabusRepo, subject.id, "Idempotency");

    const otherDomain = await deps.syllabusRepo.createDomain({ name: "Languages" });
    const otherSubject = await deps.syllabusRepo.createSubject(otherDomain.id, { name: "Spanish" });
    await studyConcept(deps.syllabusRepo, otherSubject.id, "Subjunctive");

    const drill = await startDueDrill(deps, { domainId: domain.id });

    const questions = await deps.questionsRepo.listDrillQuestions(drill.id);
    expect(new Set(questions.flatMap((question) => question.conceptIds))).toEqual(new Set([inDomain.id]));
  });

  it("caps the Drill at the maximum number of Questions", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    for (let index = 0; index < 12; index += 1) {
      await studyConcept(deps.syllabusRepo, subject.id, `Concept ${index}`);
    }

    const drill = await startDueDrill(deps, { domainId: domain.id, maxQuestions: 4 });

    expect((await deps.questionsRepo.listDrillQuestions(drill.id)).length).toBeLessThanOrEqual(4);
  });

  it("asks a scenario combining newly-studied Concepts from two Subjects of the Domain", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const systemDesign = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const mlSystemDesign = await deps.syllabusRepo.createSubject(domain.id, { name: "ML System Design" });
    const queues = await studyConcept(deps.syllabusRepo, systemDesign.id, "Queues");
    const latency = await studyConcept(deps.syllabusRepo, mlSystemDesign.id, "Model latency");
    const generateQuestion = vi.spyOn(deps.llmPort, "generateQuestion");

    const drill = await startDueDrill(deps, { domainId: domain.id });

    const scenario = (await deps.questionsRepo.listDrillQuestions(drill.id)).find(
      (question) => question.type === "scenario",
    );
    expect(new Set(scenario?.conceptIds)).toEqual(new Set([queues.id, latency.id]));
    expect(scenario?.prompt).toContain("Queues");
    expect(scenario?.prompt).toContain("Model latency");
    expect(generateQuestion).toHaveBeenCalledWith({
      type: "scenario",
      concepts: expect.arrayContaining([
        { name: "Queues", notes: null },
        { name: "Model latency", notes: null },
      ]),
    });
  });

  it("throws NotFoundError for a missing Domain", async () => {
    const deps = buildDeps();

    await expect(startDueDrill(deps, { domainId: "missing" })).rejects.toThrow(NotFoundError);
  });

  it("throws NoDueConceptsError when nothing in the Domain is due", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    await studyConcept(deps.syllabusRepo, subject.id, "Idempotency", {
      intervalDays: 30,
      easeFactor: 2.5,
      nextDueAt: FAR_FUTURE,
    });

    await expect(startDueDrill(deps, { domainId: domain.id })).rejects.toThrow(NoDueConceptsError);
  });

  it("persists nothing when generating any one Question fails", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    await studyConcept(deps.syllabusRepo, subject.id, "Idempotency");
    await studyConcept(deps.syllabusRepo, subject.id, "Caching");

    let calls = 0;
    const llmPort = new FakeLlmPort(async () => {
      calls += 1;
      if (calls === 2) {
        throw new Error("LLM is down");
      }
      return { type: "recall", prompt: "Explain something." };
    });
    const createDrill = vi.spyOn(deps.drillsRepo, "createDrill");
    const createQuestions = vi.spyOn(deps.questionsRepo, "createQuestions");

    await expect(startDueDrill({ ...deps, llmPort }, { domainId: domain.id })).rejects.toThrow(
      DrillGenerationError,
    );
    expect(createDrill).not.toHaveBeenCalled();
    expect(createQuestions).not.toHaveBeenCalled();
  });
});
