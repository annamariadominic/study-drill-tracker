import { describe, expect, it } from "vitest";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { NotFoundError as QuestionsNotFoundError } from "@/lib/questions/errors";
import { FakeLlmPort } from "@/lib/llm/fake-port";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";
import { submitAttempt } from "./submit-attempt";

async function buildStudiedConcept(syllabusRepo: FakeSyllabusRepository) {
  const domain = await syllabusRepo.createDomain({ name: "Software Engineering" });
  const subject = await syllabusRepo.createSubject(domain.id, { name: "System Design" });
  const concept = await syllabusRepo.createConcept(subject.id, { name: "Idempotency" });
  return syllabusRepo.setConceptStatus(concept.id, "studied");
}

describe("submitAttempt", () => {
  it("grades a flashcard answer mechanically and never calls the LLM port", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptId: concept.id,
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    const attempt = await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "confident", selectedOptionIndex: 0 },
    );

    expect(attempt.correctness).toBe("correct");
    expect(attempt.confidence).toBe("confident");
    expect(llmPort.gradeAnswerCallCount).toBe(0);
  });

  it("marks a wrong flashcard selection incorrect", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptId: concept.id,
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    const attempt = await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "guessed", selectedOptionIndex: 1 },
    );

    expect(attempt.correctness).toBe("incorrect");
    expect(attempt.gradedExplanation).toContain("Correct one");
  });

  it("grades a recall answer via the LLM port", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort(undefined, async () => ({
      correctness: "partial",
      explanation: "Close, but missing detail.",
    }));
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptId: concept.id,
      type: "recall",
      prompt: "Explain idempotency.",
    });

    const attempt = await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "partial", submittedAnswer: "Retrying is safe." },
    );

    expect(attempt.correctness).toBe("partial");
    expect(attempt.gradedExplanation).toBe("Close, but missing detail.");
    expect(llmPort.gradeAnswerCallCount).toBe(1);
  });

  it("rejects a flashcard selectedOptionIndex that is out of range", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptId: concept.id,
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    await expect(
      submitAttempt(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: question.id, confidence: "guessed", selectedOptionIndex: 99 },
      ),
    ).rejects.toThrow(/valid option index/);
  });

  it("throws NotFoundError for a missing question", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();

    await expect(
      submitAttempt(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: "missing", confidence: "guessed", submittedAnswer: "x" },
      ),
    ).rejects.toThrow(QuestionsNotFoundError);
  });

  it("propagates an LLM grading failure instead of persisting a broken attempt", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort(undefined, async () => {
      throw new Error("LLM is down");
    });
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptId: concept.id,
      type: "recall",
      prompt: "Explain idempotency.",
    });

    await expect(
      submitAttempt(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: question.id, confidence: "guessed", submittedAnswer: "x" },
      ),
    ).rejects.toThrow("LLM is down");
  });

  it("updates the Concept's review schedule after a correct attempt", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptId: concept.id,
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "confident", selectedOptionIndex: 0 },
    );

    const updatedConcept = await syllabusRepo.getConcept(concept.id);
    expect(updatedConcept?.reviewIntervalDays).toBeGreaterThan(concept.reviewIntervalDays ?? 0);
    expect(updatedConcept?.nextReviewDueAt).not.toBe(concept.nextReviewDueAt);
  });

  it("resets the Concept's review interval to one day after an incorrect attempt", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptId: concept.id,
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "guessed", selectedOptionIndex: 1 },
    );

    const updatedConcept = await syllabusRepo.getConcept(concept.id);
    expect(updatedConcept?.reviewIntervalDays).toBe(1);
  });

  it("leaves a Concept's review schedule null if it has since been marked planned again", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptId: concept.id,
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });
    await syllabusRepo.setConceptStatus(concept.id, "planned");

    await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "confident", selectedOptionIndex: 0 },
    );

    const updatedConcept = await syllabusRepo.getConcept(concept.id);
    expect(updatedConcept?.status).toBe("planned");
    expect(updatedConcept?.reviewIntervalDays).toBeNull();
    expect(updatedConcept?.nextReviewDueAt).toBeNull();
  });

  it("advances a Concept's review schedule only once per Drill", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);

    const recall = await questionsRepo.createQuestion({
      conceptId: concept.id,
      drillId: "drill-1",
      position: 0,
      type: "recall",
      prompt: "Explain idempotency.",
    });
    const flashcard = await questionsRepo.createQuestion({
      conceptId: concept.id,
      drillId: "drill-1",
      position: 1,
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: recall.id, confidence: "confident", submittedAnswer: "No extra effect." },
    );
    const afterFirst = await syllabusRepo.getConcept(concept.id);

    await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: flashcard.id, confidence: "confident", selectedOptionIndex: 0 },
    );
    const afterSecond = await syllabusRepo.getConcept(concept.id);

    expect(afterFirst?.reviewIntervalDays).toBeGreaterThan(1);
    expect(afterSecond?.reviewIntervalDays).toBe(afterFirst?.reviewIntervalDays);
    expect(afterSecond?.reviewEaseFactor).toBe(afterFirst?.reviewEaseFactor);
  });

  it("still records the second Attempt on a Concept within a Drill", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);

    const first = await questionsRepo.createQuestion({
      conceptId: concept.id,
      drillId: "drill-1",
      position: 0,
      type: "recall",
      prompt: "Explain idempotency.",
    });
    const second = await questionsRepo.createQuestion({
      conceptId: concept.id,
      drillId: "drill-1",
      position: 1,
      type: "recall",
      prompt: "Explain it again.",
    });

    await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: first.id, confidence: "confident", submittedAnswer: "No extra effect." },
    );
    const attempt = await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: second.id, confidence: "guessed", submittedAnswer: "Something else." },
    );

    expect(await questionsRepo.getAttempt(attempt.id)).toEqual(attempt);
    expect(attempt.correctness).toBe("correct");
  });

  it("advances the schedule again for a Concept reviewed outside a Drill", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);

    const first = await questionsRepo.createQuestion({
      conceptId: concept.id,
      type: "recall",
      prompt: "Explain idempotency.",
    });
    const second = await questionsRepo.createQuestion({
      conceptId: concept.id,
      type: "recall",
      prompt: "Explain idempotency again.",
    });

    await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: first.id, confidence: "confident", submittedAnswer: "No extra effect." },
    );
    const afterFirst = await syllabusRepo.getConcept(concept.id);

    await submitAttempt(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: second.id, confidence: "confident", submittedAnswer: "No extra effect." },
    );
    const afterSecond = await syllabusRepo.getConcept(concept.id);

    expect(afterSecond?.reviewIntervalDays).toBeGreaterThan(afterFirst?.reviewIntervalDays ?? 0);
  });
});
