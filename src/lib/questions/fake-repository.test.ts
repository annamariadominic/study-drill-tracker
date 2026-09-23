import { beforeEach, describe, expect, it } from "vitest";
import { QuestionIntegrityError } from "./errors";
import { FakeQuestionsRepository } from "./fake-repository";

describe("FakeQuestionsRepository", () => {
  let repo: FakeQuestionsRepository;

  beforeEach(() => {
    repo = new FakeQuestionsRepository();
  });

  it("creates and retrieves a recall question with no options", async () => {
    const question = await repo.createQuestion({
      conceptIds: ["concept-1"],
      type: "recall",
      prompt: "Explain idempotency.",
    });

    expect(question.options).toBeNull();
    expect(question.correctOptionIndex).toBeNull();
    expect(await repo.getQuestion(question.id)).toEqual(question);
  });

  it("creates and retrieves a flashcard question with options", async () => {
    const question = await repo.createQuestion({
      conceptIds: ["concept-1"],
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["A", "B", "C"],
      correctOptionIndex: 1,
    });

    expect(question.options).toEqual(["A", "B", "C"]);
    expect(question.correctOptionIndex).toBe(1);
  });

  it("creates a scenario question over several Concepts, keeping their order", async () => {
    const question = await repo.createQuestion({
      conceptIds: ["concept-2", "concept-1", "concept-3"],
      type: "scenario",
      prompt: "Design a rate-limited ML API.",
    });

    expect(question.conceptIds).toEqual(["concept-2", "concept-1", "concept-3"]);
    expect(await repo.getQuestion(question.id)).toEqual(question);
  });

  it.each([
    ["a recall question with two Concepts", "recall", ["concept-1", "concept-2"]],
    ["a flashcard question with no Concepts", "flashcard", []],
    ["a scenario question with one Concept", "scenario", ["concept-1"]],
    ["a scenario question naming a Concept twice", "scenario", ["concept-1", "concept-1"]],
  ] as const)("refuses %s", async (_, type, conceptIds) => {
    await expect(
      repo.createQuestion({ conceptIds: [...conceptIds], type, prompt: "Anything." }),
    ).rejects.toThrow(QuestionIntegrityError);
  });

  it("creates none of a batch when one question breaks the Concept invariant", async () => {
    await expect(
      repo.createQuestions([
        { conceptIds: ["concept-1"], type: "recall", prompt: "Fine.", drillId: "drill-1", position: 0 },
        { conceptIds: ["concept-1"], type: "scenario", prompt: "Too few.", drillId: "drill-1", position: 1 },
      ]),
    ).rejects.toThrow(QuestionIntegrityError);

    expect(await repo.listDrillQuestions("drill-1")).toEqual([]);
  });

  it("returns null for a missing question", async () => {
    expect(await repo.getQuestion("missing")).toBeNull();
  });

  it("creates and retrieves an attempt", async () => {
    const question = await repo.createQuestion({
      conceptIds: ["concept-1"],
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
      conceptIds: ["concept-2"],
      type: "recall",
      prompt: "Second.",
      drillId: "drill-1",
      position: 1,
    });
    const first = await repo.createQuestion({
      conceptIds: ["concept-1"],
      type: "recall",
      prompt: "First.",
      drillId: "drill-1",
      position: 0,
    });
    await repo.createQuestion({
      conceptIds: ["concept-3"],
      type: "recall",
      prompt: "Other drill.",
      drillId: "drill-2",
      position: 0,
    });
    await repo.createQuestion({ conceptIds: ["concept-4"], type: "recall", prompt: "Standalone." });

    expect((await repo.listDrillQuestions("drill-1")).map((q) => q.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it("lists attempts for the given questions only", async () => {
    const question = await repo.createQuestion({
      conceptIds: ["concept-1"],
      type: "recall",
      prompt: "Explain idempotency.",
    });
    const other = await repo.createQuestion({
      conceptIds: ["concept-2"],
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
