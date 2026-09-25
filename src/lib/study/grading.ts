import type { Attempt, UngradedAttempt } from "@/lib/questions/types";

/**
 * How long a grade has to arrive once grading starts: the max duration of the
 * routes that grade after responding (the attempts route and the grading
 * retry), which Next.js needs written out as a literal there. Past it the
 * grading can no longer finish, so a still-pending Attempt is taken as failed.
 */
export const GRADING_TIME_LIMIT_MS = 300_000;

/** How an Attempt's grade stands, as the learner sees it. */
export type GradingState = "graded" | "grading" | "failed";

export function gradingState(attempt: Attempt, now: Date = new Date()): GradingState {
  return attempt.gradingStatus === "graded" ? "graded" : ungradedState(attempt, now);
}

/** Whether an Attempt without a grade is still grading, or has failed (or stalled) and can be retried. */
export function ungradedState(attempt: UngradedAttempt, now: Date = new Date()): "grading" | "failed" {
  const stalled = Date.parse(attempt.gradingStartedAt) < gradingStalledBefore(now).getTime();
  return attempt.gradingStatus === "pending" && !stalled ? "grading" : "failed";
}

/** A pending Attempt whose grading started before this can no longer be graded by that run. */
export function gradingStalledBefore(now: Date = new Date()): Date {
  return new Date(now.getTime() - GRADING_TIME_LIMIT_MS);
}

/** An Attempt's feedback screen: in its Drill, or on its one-off Question's page. */
export function feedbackPath(question: { id: string; drillId: string | null }, attemptId: string): string {
  const page = question.drillId
    ? `/study/drills/${encodeURIComponent(question.drillId)}`
    : `/study/questions/${question.id}`;
  return `${page}?attemptId=${attemptId}`;
}
