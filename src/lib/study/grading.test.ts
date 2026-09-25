import { describe, expect, it } from "vitest";
import type { Attempt } from "@/lib/questions/types";
import { GRADING_TIME_LIMIT_MS, gradingState } from "./grading";

const now = new Date("2026-01-01T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

function attempt(gradingStatus: Attempt["gradingStatus"], gradingStartedAt: string): Attempt {
  const base = {
    id: "a1",
    questionId: "q1",
    submittedAnswer: "An answer.",
    confidence: "partial" as const,
    advancesConceptIds: [],
    gradingStartedAt,
    createdAt: gradingStartedAt,
  };
  return gradingStatus === "graded"
    ? { ...base, gradingStatus, correctness: "correct", gradedExplanation: "Right.", referenceAnswer: null }
    : { ...base, gradingStatus, correctness: null, gradedExplanation: null, referenceAnswer: null };
}

describe("gradingState", () => {
  it("is grading while a pending grade can still arrive", () => {
    expect(gradingState(attempt("pending", ago(1000)), now)).toBe("grading");
    expect(gradingState(attempt("pending", ago(GRADING_TIME_LIMIT_MS - 1)), now)).toBe("grading");
  });

  it("treats a pending grade past the time limit as failed, since it can no longer finish", () => {
    expect(gradingState(attempt("pending", ago(GRADING_TIME_LIMIT_MS + 1)), now)).toBe("failed");
  });

  it("reports graded and failed Attempts as they are, however old", () => {
    expect(gradingState(attempt("graded", ago(GRADING_TIME_LIMIT_MS * 10)), now)).toBe("graded");
    expect(gradingState(attempt("failed", ago(1000)), now)).toBe("failed");
  });
});
