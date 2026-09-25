import { describe, expect, it } from "vitest";
import type { Attempt, Correctness, Question } from "@/lib/questions/types";
import { drillProgress, stepOutcome } from "./drill-progress";

function question(id: string, position: number): Question {
  return {
    id,
    conceptIds: [`concept-${id}`],
    drillId: "drill-1",
    position,
    type: "recall",
    prompt: `Explain ${id}.`,
    options: null,
    correctOptionIndex: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function ungraded(id: string, questionId: string, gradingStatus: "pending" | "failed"): Attempt {
  return {
    ...attempt(id, questionId, "correct"),
    gradingStatus,
    correctness: null,
    gradedExplanation: null,
    referenceAnswer: null,
  };
}

function attempt(id: string, questionId: string, correctness: Correctness): Attempt {
  return {
    id,
    questionId,
    submittedAnswer: "An answer.",
    confidence: "partial",
    advancesConceptIds: [],
    gradingStatus: "graded",
    correctness,
    gradedExplanation: "Because.",
    referenceAnswer: null,
    createdAt: "2026-01-01T00:01:00.000Z",
  };
}

describe("drillProgress", () => {
  const questions = [question("q1", 0), question("q2", 1), question("q3", 2)];

  it("points at the first Question when nothing has been answered", () => {
    const progress = drillProgress(questions, []);

    expect(progress.currentQuestion?.id).toBe("q1");
    expect(progress.answeredCount).toBe(0);
    expect(progress.completed).toBe(false);
  });

  it("points at the first unanswered Question and pairs each Question with its Attempt", () => {
    const answered = attempt("a1", "q1", "correct");

    const progress = drillProgress(questions, [answered]);

    expect(progress.currentQuestion?.id).toBe("q2");
    expect(progress.answeredCount).toBe(1);
    expect(progress.steps.map((step) => step.attempt?.id ?? null)).toEqual([
      "a1",
      null,
      null,
    ]);
  });

  it("is complete once every Question has an Attempt, and counts the outcomes", () => {
    const progress = drillProgress(questions, [
      attempt("a1", "q1", "correct"),
      attempt("a2", "q2", "partial"),
      attempt("a3", "q3", "incorrect"),
    ]);

    expect(progress.completed).toBe(true);
    expect(progress.currentQuestion).toBeNull();
    expect(progress.summary).toEqual({ correct: 1, partial: 1, incorrect: 1, grading: 0, failed: 0, total: 3 });
  });

  it("counts only the first Attempt on a Question", () => {
    const progress = drillProgress([question("q1", 0)], [
      attempt("a1", "q1", "incorrect"),
      { ...attempt("a2", "q1", "correct"), createdAt: "2026-01-01T00:02:00.000Z" },
    ]);

    expect(progress.summary).toEqual({ correct: 0, partial: 0, incorrect: 1, grading: 0, failed: 0, total: 1 });
    expect(progress.steps[0].attempt?.id).toBe("a1");
  });

  it("treats an empty Drill as complete with an empty summary", () => {
    const progress = drillProgress([], []);

    expect(progress.completed).toBe(true);
    expect(progress.summary).toEqual({ correct: 0, partial: 0, incorrect: 0, grading: 0, failed: 0, total: 0 });
  });

  it("counts an Attempt still being graded as answered, and moves on to the next Question", () => {
    const progress = drillProgress(questions, [attempt("a1", "q1", "correct"), ungraded("a2", "q2", "pending")]);

    expect(progress.currentQuestion?.id).toBe("q3");
    expect(progress.answeredCount).toBe(2);
    expect(progress.gradingAttemptIds).toEqual(["a2"]);
  });

  it("summarises only graded Attempts, counting the rest as grading or failed", () => {
    const progress = drillProgress(questions, [
      attempt("a1", "q1", "correct"),
      ungraded("a2", "q2", "pending"),
      ungraded("a3", "q3", "failed"),
    ]);

    expect(progress.completed).toBe(true);
    expect(progress.summary).toEqual({ correct: 1, partial: 0, incorrect: 0, grading: 1, failed: 1, total: 3 });
    expect(progress.gradingAttemptIds).toEqual(["a2"]);
  });

  it("gives each step its outcome: the grade, grading, failed, or nothing while unanswered", () => {
    const progress = drillProgress(questions, [ungraded("a1", "q1", "pending"), ungraded("a2", "q2", "failed")]);
    const graded = drillProgress(questions, [attempt("a1", "q1", "partial")]);

    expect(progress.steps.map(stepOutcome)).toEqual(["grading", "failed", null]);
    expect(stepOutcome(graded.steps[0])).toBe("partial");
  });
});
