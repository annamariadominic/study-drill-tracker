import { beforeEach, describe, expect, it } from "vitest";
import { FakeQuestionsRepository } from "./fake-repository";

describe("FakeQuestionsRepository", () => {
  let repo: FakeQuestionsRepository;

  beforeEach(() => {
    repo = new FakeQuestionsRepository();
  });

  it("creates and retrieves a recall question with no options", async () => {
    const question = await repo.createQuestion({
      conceptId: "concept-1",
      type: "recall",
      prompt: "Explain idempotency.",
    });

    expect(question.options).toBeNull();
    expect(question.correctOptionIndex).toBeNull();
    expect(await repo.getQuestion(question.id)).toEqual(question);
  });

  it("creates and retrieves a flashcard question with options", async () => {
    const question = await repo.createQuestion({
      conceptId: "concept-1",
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["A", "B", "C"],
      correctOptionIndex: 1,
    });

    expect(question.options).toEqual(["A", "B", "C"]);
    expect(question.correctOptionIndex).toBe(1);
  });

  it("returns null for a missing question", async () => {
    expect(await repo.getQuestion("missing")).toBeNull();
  });

  it("creates and retrieves an attempt", async () => {
    const question = await repo.createQuestion({
      conceptId: "concept-1",
      type: "recall",
      prompt: "Explain idempotency.",
    });

    const attempt = await repo.createAttempt({
      questionId: question.id,
      submittedAnswer: "Retrying has no extra effect.",
      confidence: "confident",
      correctness: "correct",
      gradedExplanation: "Correct.",
    });

    expect(await repo.getAttempt(attempt.id)).toEqual(attempt);
  });

  it("returns null for a missing attempt", async () => {
    expect(await repo.getAttempt("missing")).toBeNull();
  });

  it("lists a drill's questions in position order and leaves out other questions", async () => {
    const second = await repo.createQuestion({
      conceptId: "concept-2",
      type: "recall",
      prompt: "Second.",
      drillId: "drill-1",
      position: 1,
    });
    const first = await repo.createQuestion({
      conceptId: "concept-1",
      type: "recall",
      prompt: "First.",
      drillId: "drill-1",
      position: 0,
    });
    await repo.createQuestion({
      conceptId: "concept-3",
      type: "recall",
      prompt: "Other drill.",
      drillId: "drill-2",
      position: 0,
    });
    await repo.createQuestion({ conceptId: "concept-4", type: "recall", prompt: "Standalone." });

    expect((await repo.listDrillQuestions("drill-1")).map((q) => q.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it("lists attempts for the given questions only", async () => {
    const question = await repo.createQuestion({
      conceptId: "concept-1",
      type: "recall",
      prompt: "Explain idempotency.",
    });
    const other = await repo.createQuestion({
      conceptId: "concept-2",
      type: "recall",
      prompt: "Explain retries.",
    });
    const attempt = await repo.createAttempt({
      questionId: question.id,
      submittedAnswer: "Retrying has no extra effect.",
      confidence: "confident",
      correctness: "correct",
      gradedExplanation: "Correct.",
    });
    await repo.createAttempt({
      questionId: other.id,
      submittedAnswer: "Try again.",
      confidence: "guessed",
      correctness: "partial",
      gradedExplanation: "Partly.",
    });

    expect(await repo.listAttemptsForQuestions([question.id])).toEqual([attempt]);
    expect(await repo.listAttemptsForQuestions([])).toEqual([]);
  });
});
