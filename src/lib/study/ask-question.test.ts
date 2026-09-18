import { describe, expect, it } from "vitest";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";
import { NotFoundError as SyllabusNotFoundError } from "@/lib/syllabus/errors";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { FakeLlmPort } from "@/lib/llm/fake-port";
import { askQuestion } from "./ask-question";
import { ConceptNotStudiedError } from "./errors";

async function buildStudiedConcept(syllabusRepo: FakeSyllabusRepository) {
  const domain = await syllabusRepo.createDomain({ name: "Software Engineering" });
  const subject = await syllabusRepo.createSubject(domain.id, { name: "System Design" });
  const concept = await syllabusRepo.createConcept(subject.id, {
    name: "Idempotency",
    notes: "Retrying has no extra effect.",
  });
  return syllabusRepo.setConceptStatus(concept.id, "studied");
}

describe("askQuestion", () => {
  it("generates and persists a recall question for a studied concept", async () => {
    const syllabusRepo = new FakeSyllabusRepository();
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);

    const question = await askQuestion(
      { syllabusRepo, questionsRepo, llmPort },
      { conceptId: concept.id, type: "recall" },
    );

    expect(question.type).toBe("recall");
    expect(question.prompt).toContain("Idempotency");
    expect(question.options).toBeNull();
    expect(await questionsRepo.getQuestion(question.id)).toEqual(question);
  });

  it("generates and persists a flashcard question with options", async () => {
    const syllabusRepo = new FakeSyllabusRepository();
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);

    const question = await askQuestion(
      { syllabusRepo, questionsRepo, llmPort },
      { conceptId: concept.id, type: "flashcard" },
    );

    expect(question.type).toBe("flashcard");
    expect(question.options?.length).toBeGreaterThan(1);
    expect(question.correctOptionIndex).not.toBeNull();
  });

  it("throws NotFoundError for a missing concept", async () => {
    const syllabusRepo = new FakeSyllabusRepository();
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort();

    await expect(
      askQuestion({ syllabusRepo, questionsRepo, llmPort }, { conceptId: "missing", type: "recall" }),
    ).rejects.toThrow(SyllabusNotFoundError);
  });

  it("throws ConceptNotStudiedError for a planned concept", async () => {
    const syllabusRepo = new FakeSyllabusRepository();
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort();
    const domain = await syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const concept = await syllabusRepo.createConcept(subject.id, { name: "Idempotency" });

    await expect(
      askQuestion(
        { syllabusRepo, questionsRepo, llmPort },
        { conceptId: concept.id, type: "recall" },
      ),
    ).rejects.toThrow(ConceptNotStudiedError);
  });

  it("propagates an LLM generation failure instead of persisting a broken question", async () => {
    const syllabusRepo = new FakeSyllabusRepository();
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort(async () => {
      throw new Error("LLM is down");
    });
    const concept = await buildStudiedConcept(syllabusRepo);

    await expect(
      askQuestion(
        { syllabusRepo, questionsRepo, llmPort },
        { conceptId: concept.id, type: "recall" },
      ),
    ).rejects.toThrow("LLM is down");
  });
});
