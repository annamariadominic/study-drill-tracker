import { describe, expect, it, vi } from "vitest";
import { FakeLlmPort } from "@/lib/llm/fake-port";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { ConceptNotStudiedError } from "@/lib/study/errors";
import { NotFoundError } from "@/lib/syllabus/errors";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";
import { FakeDrillsRepository } from "./fake-repository";
import { DrillGenerationError, MixedDomainsError, NoStudiedConceptsError } from "./errors";
import { startRandomDrill } from "./start-random-drill";

const FAR_FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

function buildDeps() {
  return {
    syllabusRepo: new FakeSyllabusRepository(),
    drillsRepo: new FakeDrillsRepository(),
    questionsRepo: new FakeQuestionsRepository(),
    llmPort: new FakeLlmPort(),
  };
}

/** A studied Concept that isn't due for a year. */
async function studyConcept(syllabusRepo: FakeSyllabusRepository, subjectId: string, name: string) {
  const concept = await syllabusRepo.createConcept(subjectId, { name });
  await syllabusRepo.setConceptStatus(concept.id, "studied");
  await syllabusRepo.updateConceptReviewSchedule(concept.id, {
    intervalDays: 6,
    easeFactor: 2.5,
    nextDueAt: FAR_FUTURE,
  });
  return concept;
}

async function drillConceptIds(deps: ReturnType<typeof buildDeps>, drillId: string) {
  const questions = await deps.questionsRepo.listDrillQuestions(drillId);
  return new Set(questions.flatMap((question) => question.conceptIds));
}

describe("startRandomDrill", () => {
  it("drills the whole library when unscoped, even when nothing is due", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const systemDesign = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const apiDesign = await deps.syllabusRepo.createSubject(domain.id, { name: "API Design" });
    const queues = await studyConcept(deps.syllabusRepo, systemDesign.id, "Queues");
    const pagination = await studyConcept(deps.syllabusRepo, apiDesign.id, "Pagination");
    await deps.syllabusRepo.createConcept(apiDesign.id, { name: "Planned, not studied" });

    const drill = await startRandomDrill(deps, { scope: { kind: "library" } });

    expect(drill.domainId).toBe(domain.id);
    expect(drill.scope).toBe("random");
    expect(drill.scopeDetail).toEqual({ kind: "library" });
    expect(await deps.drillsRepo.getDrill(drill.id)).toEqual(drill);
    expect(await drillConceptIds(deps, drill.id)).toEqual(new Set([queues.id, pagination.id]));
  });

  it("keeps a whole-library Drill within the one Domain it draws", async () => {
    const deps = buildDeps();
    const software = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const systemDesign = await deps.syllabusRepo.createSubject(software.id, { name: "System Design" });
    const queues = await studyConcept(deps.syllabusRepo, systemDesign.id, "Queues");
    const languages = await deps.syllabusRepo.createDomain({ name: "Languages" });
    const spanish = await deps.syllabusRepo.createSubject(languages.id, { name: "Spanish" });
    const subjunctive = await studyConcept(deps.syllabusRepo, spanish.id, "Subjunctive");

    const first = await startRandomDrill(deps, { scope: { kind: "library" }, random: () => 0 });
    const last = await startRandomDrill(deps, { scope: { kind: "library" }, random: () => 0.99 });

    const drawn = [first, last].map((drill) => drill.domainId);
    expect(new Set(drawn)).toEqual(new Set([software.id, languages.id]));
    for (const drill of [first, last]) {
      const expected = drill.domainId === software.id ? queues.id : subjunctive.id;
      expect(await drillConceptIds(deps, drill.id)).toEqual(new Set([expected]));
    }
  });

  it("draws only on one Subject's studied Concepts when scoped to it", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const systemDesign = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const apiDesign = await deps.syllabusRepo.createSubject(domain.id, { name: "API Design" });
    const queues = await studyConcept(deps.syllabusRepo, systemDesign.id, "Queues");
    const retries = await studyConcept(deps.syllabusRepo, systemDesign.id, "Retries");
    await studyConcept(deps.syllabusRepo, apiDesign.id, "Pagination");

    const drill = await startRandomDrill(deps, {
      scope: { kind: "subject", subjectId: systemDesign.id },
    });

    expect(drill.domainId).toBe(domain.id);
    expect(drill.scopeDetail).toEqual({ kind: "subject", subjectId: systemDesign.id });
    expect(await drillConceptIds(deps, drill.id)).toEqual(new Set([queues.id, retries.id]));
  });

  it("draws only on hand-picked Concepts, combining them in a scenario across Subjects", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const systemDesign = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const mlSystemDesign = await deps.syllabusRepo.createSubject(domain.id, { name: "ML System Design" });
    const queues = await studyConcept(deps.syllabusRepo, systemDesign.id, "Queues");
    await studyConcept(deps.syllabusRepo, systemDesign.id, "Retries");
    const latency = await studyConcept(deps.syllabusRepo, mlSystemDesign.id, "Model latency");
    const generateQuestion = vi.spyOn(deps.llmPort, "generateQuestion");

    const drill = await startRandomDrill(deps, {
      scope: { kind: "concepts", conceptIds: [queues.id, latency.id, queues.id] },
    });

    expect(drill.domainId).toBe(domain.id);
    expect(drill.scopeDetail).toEqual({ kind: "concepts", conceptIds: [queues.id, latency.id] });
    expect(await drillConceptIds(deps, drill.id)).toEqual(new Set([queues.id, latency.id]));

    const scenario = (await deps.questionsRepo.listDrillQuestions(drill.id)).find(
      (question) => question.type === "scenario",
    );
    expect(new Set(scenario?.conceptIds)).toEqual(new Set([queues.id, latency.id]));
    expect(generateQuestion).toHaveBeenCalledWith({
      type: "scenario",
      concepts: expect.arrayContaining([
        { name: "Queues", notes: null },
        { name: "Model latency", notes: null },
      ]),
    });
  });

  it("asks about every hand-picked Concept, even past the usual question limit", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const picked: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      const concept = await deps.syllabusRepo.createConcept(subject.id, { name: `Concept ${index}` });
      await deps.syllabusRepo.setConceptStatus(concept.id, "studied");
      picked.push(concept.id);
    }

    const drill = await startRandomDrill(deps, { scope: { kind: "concepts", conceptIds: picked } });

    expect(await drillConceptIds(deps, drill.id)).toEqual(new Set(picked));
  });

  it("refuses hand-picked Concepts from different Domains, persisting nothing", async () => {
    const deps = buildDeps();
    const software = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const systemDesign = await deps.syllabusRepo.createSubject(software.id, { name: "System Design" });
    const queues = await studyConcept(deps.syllabusRepo, systemDesign.id, "Queues");
    const languages = await deps.syllabusRepo.createDomain({ name: "Languages" });
    const spanish = await deps.syllabusRepo.createSubject(languages.id, { name: "Spanish" });
    const subjunctive = await studyConcept(deps.syllabusRepo, spanish.id, "Subjunctive");
    const createDrill = vi.spyOn(deps.drillsRepo, "createDrill");

    await expect(
      startRandomDrill(deps, { scope: { kind: "concepts", conceptIds: [queues.id, subjunctive.id] } }),
    ).rejects.toThrow(MixedDomainsError);
    expect(createDrill).not.toHaveBeenCalled();
  });

  it("refuses a hand-picked Concept that isn't studied yet", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const planned = await deps.syllabusRepo.createConcept(subject.id, { name: "Sharding" });

    await expect(
      startRandomDrill(deps, { scope: { kind: "concepts", conceptIds: [planned.id] } }),
    ).rejects.toThrow(ConceptNotStudiedError);
  });

  it("throws NotFoundError for a missing Subject or Concept", async () => {
    const deps = buildDeps();

    await expect(
      startRandomDrill(deps, { scope: { kind: "subject", subjectId: "missing" } }),
    ).rejects.toThrow(NotFoundError);
    await expect(
      startRandomDrill(deps, { scope: { kind: "concepts", conceptIds: ["missing"] } }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws NoStudiedConceptsError when the scope has nothing studied to drill", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    await deps.syllabusRepo.createConcept(subject.id, { name: "Planned, not studied" });

    await expect(startRandomDrill(deps, { scope: { kind: "library" } })).rejects.toThrow(
      NoStudiedConceptsError,
    );
    await expect(
      startRandomDrill(deps, { scope: { kind: "subject", subjectId: subject.id } }),
    ).rejects.toThrow(NoStudiedConceptsError);
    await expect(
      startRandomDrill(deps, { scope: { kind: "concepts", conceptIds: [] } }),
    ).rejects.toThrow(NoStudiedConceptsError);
  });

  it("persists nothing when generating any one Question fails", async () => {
    const deps = buildDeps();
    const domain = await deps.syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await deps.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    await studyConcept(deps.syllabusRepo, subject.id, "Queues");
    const llmPort = new FakeLlmPort(async () => {
      throw new Error("LLM is down");
    });
    const createDrill = vi.spyOn(deps.drillsRepo, "createDrill");

    await expect(
      startRandomDrill({ ...deps, llmPort }, { scope: { kind: "library" } }),
    ).rejects.toThrow(DrillGenerationError);
    expect(createDrill).not.toHaveBeenCalled();
  });
});
