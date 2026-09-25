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

  it("lists a drill's attempts, oldest first, and leaves out other questions' attempts", async () => {
    const first = await repo.createQuestion({
      conceptIds: ["concept-1"],
      type: "recall",
      prompt: "Explain idempotency.",
      drillId: "drill-1",
      position: 0,
    });
    const second = await repo.createQuestion({
      conceptIds: ["concept-2"],
      type: "recall",
      prompt: "Explain retries.",
      drillId: "drill-1",
      position: 1,
    });
    const otherDrill = await repo.createQuestion({
      conceptIds: ["concept-3"],
      type: "recall",
      prompt: "Explain backoff.",
      drillId: "drill-2",
      position: 0,
    });
    const standalone = await repo.createQuestion({ conceptIds: ["concept-4"], type: "recall", prompt: "Explain queues." });
    const answer = (questionId: string) =>
      repo.createAttempt({
        questionId,
        submittedAnswer: "An answer.",
        confidence: "partial",
        correctness: "partial",
        gradedExplanation: "Partly.",
      });
    const onSecond = await answer(second.id);
    await answer(otherDrill.id);
    await answer(standalone.id);
    const onFirst = await answer(first.id);

    expect(await repo.listDrillAttempts("drill-1")).toEqual([onSecond, onFirst]);
    expect(await repo.listDrillAttempts("no-such-drill")).toEqual([]);
  });
});
