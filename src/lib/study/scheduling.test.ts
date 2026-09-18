import { describe, expect, it } from "vitest";
import {
  initialReviewSchedule,
  pullReviewCloser,
  scheduleNextReview,
  type ReviewScheduleState,
} from "./scheduling";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000));
}

describe("scheduleNextReview", () => {
  it("schedules a correct+confident answer further out than a correct+guessed answer", () => {
    const state: ReviewScheduleState = { intervalDays: 4, easeFactor: 2.5, nextDueAt: NOW.toISOString() };

    const confident = scheduleNextReview(state, { correctness: "correct", confidence: "confident" }, NOW);
    const guessed = scheduleNextReview(state, { correctness: "correct", confidence: "guessed" }, NOW);

    expect(confident.intervalDays).toBeGreaterThan(guessed.intervalDays);
    expect(daysBetween(NOW.toISOString(), confident.nextDueAt)).toBe(confident.intervalDays);
    expect(daysBetween(NOW.toISOString(), guessed.nextDueAt)).toBe(guessed.intervalDays);
  });

  it("grows the ease factor and interval on repeated correct+confident answers", () => {
    let state = initialReviewSchedule(NOW);
    state = scheduleNextReview(state, { correctness: "correct", confidence: "confident" }, NOW);
    const firstInterval = state.intervalDays;
    state = scheduleNextReview(state, { correctness: "correct", confidence: "confident" }, NOW);

    expect(state.intervalDays).toBeGreaterThan(firstInterval);
  });

  it("brings a Concept back sooner after repeated incorrect answers", () => {
    let state: ReviewScheduleState = { intervalDays: 20, easeFactor: 2.8, nextDueAt: NOW.toISOString() };

    state = scheduleNextReview(state, { correctness: "incorrect", confidence: "guessed" }, NOW);
    expect(state.intervalDays).toBe(1);

    const afterFirstMiss = state;
    state = scheduleNextReview(state, { correctness: "incorrect", confidence: "guessed" }, NOW);

    expect(state.intervalDays).toBeLessThanOrEqual(afterFirstMiss.intervalDays);
    expect(state.intervalDays).toBeLessThan(20);
  });

  it("never lets the ease factor drop below the SM-2 floor", () => {
    let state: ReviewScheduleState = { intervalDays: 1, easeFactor: 1.3, nextDueAt: NOW.toISOString() };

    for (let i = 0; i < 10; i++) {
      state = scheduleNextReview(state, { correctness: "incorrect", confidence: "guessed" }, NOW);
    }

    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

describe("pullReviewCloser", () => {
  it("halves the current interval instead of resetting it", () => {
    const state: ReviewScheduleState = { intervalDays: 10, easeFactor: 2.6, nextDueAt: "2026-02-01T00:00:00.000Z" };

    const pulled = pullReviewCloser(state, NOW);

    expect(pulled.intervalDays).toBe(5);
    expect(pulled.easeFactor).toBe(state.easeFactor);
    expect(daysBetween(NOW.toISOString(), pulled.nextDueAt)).toBe(5);
  });

  it("never drops the interval below one day", () => {
    const state: ReviewScheduleState = { intervalDays: 1, easeFactor: 2.5, nextDueAt: NOW.toISOString() };

    const pulled = pullReviewCloser(state, NOW);

    expect(pulled.intervalDays).toBe(1);
  });
});
