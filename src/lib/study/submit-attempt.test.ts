import { describe, expect, it } from "vitest";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { NotFoundError as QuestionsNotFoundError } from "@/lib/questions/errors";
import { FakeLlmPort } from "@/lib/llm/fake-port";
import { submitAttempt } from "./submit-attempt";

describe("submitAttempt", () => {
  it("grades a flashcard answer mechanically and never calls the LLM port", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort();
    const question = await questionsRepo.createQuestion({
      conceptId: "concept-1",
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    const attempt = await submitAttempt(
      { questionsRepo, llmPort },
      { questionId: question.id, confidence: "confident", selectedOptionIndex: 0 },
    );

    expect(attempt.correctness).toBe("correct");
    expect(attempt.confidence).toBe("confident");
    expect(llmPort.gradeAnswerCallCount).toBe(0);
  });

  it("marks a wrong flashcard selection incorrect", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort();
    const question = await questionsRepo.createQuestion({
      conceptId: "concept-1",
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    const attempt = await submitAttempt(
      { questionsRepo, llmPort },
      { questionId: question.id, confidence: "guessed", selectedOptionIndex: 1 },
    );

    expect(attempt.correctness).toBe("incorrect");
    expect(attempt.gradedExplanation).toContain("Correct one");
  });

  it("grades a recall answer via the LLM port", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort(undefined, async () => ({
      correctness: "partial",
      explanation: "Close, but missing detail.",
    }));
    const question = await questionsRepo.createQuestion({
      conceptId: "concept-1",
      type: "recall",
      prompt: "Explain idempotency.",
    });

    const attempt = await submitAttempt(
      { questionsRepo, llmPort },
      { questionId: question.id, confidence: "partial", submittedAnswer: "Retrying is safe." },
    );

    expect(attempt.correctness).toBe("partial");
    expect(attempt.gradedExplanation).toBe("Close, but missing detail.");
    expect(llmPort.gradeAnswerCallCount).toBe(1);
  });

  it("rejects a flashcard selectedOptionIndex that is out of range", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort();
    const question = await questionsRepo.createQuestion({
      conceptId: "concept-1",
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    await expect(
      submitAttempt(
        { questionsRepo, llmPort },
        { questionId: question.id, confidence: "guessed", selectedOptionIndex: 99 },
      ),
    ).rejects.toThrow(/valid option index/);
  });

  it("throws NotFoundError for a missing question", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort();

    await expect(
      submitAttempt(
        { questionsRepo, llmPort },
        { questionId: "missing", confidence: "guessed", submittedAnswer: "x" },
      ),
    ).rejects.toThrow(QuestionsNotFoundError);
  });

  it("propagates an LLM grading failure instead of persisting a broken attempt", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort(undefined, async () => {
      throw new Error("LLM is down");
    });
    const question = await questionsRepo.createQuestion({
      conceptId: "concept-1",
      type: "recall",
      prompt: "Explain idempotency.",
    });

    await expect(
      submitAttempt(
        { questionsRepo, llmPort },
        { questionId: question.id, confidence: "guessed", submittedAnswer: "x" },
      ),
    ).rejects.toThrow("LLM is down");
  });
});
