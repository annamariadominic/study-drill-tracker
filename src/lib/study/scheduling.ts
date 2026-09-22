import type { Confidence, Correctness } from "@/lib/questions/types";

export type ReviewScheduleState = {
  intervalDays: number;
  easeFactor: number;
  nextDueAt: string;
};

const EASE_MIN = 1.3;
const EASE_MAX = 3.2;
export const EASE_DEFAULT = 2.5;

const CORRECTNESS_EASE_DELTA: Record<Correctness, number> = {
  correct: 0.15,
  partial: 0.05,
  incorrect: -0.2,
};

const CONFIDENCE_EASE_DELTA: Record<Confidence, number> = {
  guessed: -0.15,
  partial: 0,
  confident: 0.15,
};

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString();
}

function clampEase(easeFactor: number): number {
  return Math.min(EASE_MAX, Math.max(EASE_MIN, easeFactor));
}

export function initialReviewSchedule(now: Date = new Date()): ReviewScheduleState {
  return {
    intervalDays: 1,
    easeFactor: EASE_DEFAULT,
    nextDueAt: now.toISOString(),
  };
}

export function scheduleFromFields(fields: {
  reviewIntervalDays: number | null;
  reviewEaseFactor: number | null;
  nextReviewDueAt: string | null;
}): ReviewScheduleState | null {
  if (
    fields.reviewIntervalDays === null ||
    fields.reviewEaseFactor === null ||
    fields.nextReviewDueAt === null
  ) {
    return null;
  }
  return {
    intervalDays: fields.reviewIntervalDays,
    easeFactor: fields.reviewEaseFactor,
    nextDueAt: fields.nextReviewDueAt,
  };
}

export function scheduleNextReview(
  state: ReviewScheduleState,
  attempt: { correctness: Correctness; confidence: Confidence },
  now: Date = new Date(),
): ReviewScheduleState {
  if (attempt.correctness === "incorrect") {
    const easeFactor = clampEase(state.easeFactor + CORRECTNESS_EASE_DELTA.incorrect);
    const intervalDays = 1;
    return { intervalDays, easeFactor, nextDueAt: addDays(now, intervalDays) };
  }

  const easeFactor = clampEase(
    state.easeFactor + CORRECTNESS_EASE_DELTA[attempt.correctness] + CONFIDENCE_EASE_DELTA[attempt.confidence],
  );
  const intervalDays = Math.max(1, Math.round(state.intervalDays * easeFactor));
  return { intervalDays, easeFactor, nextDueAt: addDays(now, intervalDays) };
}

export function pullReviewCloser(
  state: ReviewScheduleState,
  now: Date = new Date(),
): ReviewScheduleState {
  const intervalDays = Math.max(1, Math.round(state.intervalDays / 2));
  return { intervalDays, easeFactor: state.easeFactor, nextDueAt: addDays(now, intervalDays) };
}
