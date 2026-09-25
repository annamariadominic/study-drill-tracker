import type { Attempt, Correctness, Question } from "@/lib/questions/types";
import { ungradedState } from "@/lib/study/grading";

export type DrillStep = {
  question: Question;
  /** null until the Question has been answered. */
  attempt: Attempt | null;
};

/**
 * How a Drill's Questions turned out. Only graded Attempts count towards the
 * outcomes; Attempts still being graded, or whose grading failed, are counted
 * apart until they have a grade.
 */
export type DrillSummary = Record<Correctness, number> & { grading: number; failed: number; total: number };

/** A step's outcome as the progress bar and results show it. */
export type StepOutcome = Correctness | "grading" | "failed";

export type DrillProgress = {
  steps: DrillStep[];
  /** The Question to ask next, or null once the Drill is finished. */
  currentQuestion: Question | null;
  /** Answered includes Attempts still being graded, so the learner can move on. */
  answeredCount: number;
  completed: boolean;
  summary: DrillSummary;
  /** The Attempts still waiting on their grade, to watch for it arriving. */
  gradingAttemptIds: string[];
};

/** The step's outcome, or null while its Question is unanswered. */
export function stepOutcome(step: DrillStep): StepOutcome | null {
  const { attempt } = step;
  if (!attempt) {
    return null;
  }
  return attempt.gradingStatus === "graded" ? attempt.correctness : ungradedState(attempt);
}

/**
 * Where a Drill has got to, given its Questions and the Attempts recorded
 * against them. A Question is answered once it has an Attempt; only the first
 * Attempt counts, so re-submitting can't re-write the Drill's outcome. An
 * Attempt counts as answered while it's still being graded.
 */
export function drillProgress(questions: Question[], attempts: Attempt[]): DrillProgress {
  const firstAttempts = new Map<string, Attempt>();
  for (const attempt of [...attempts].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!firstAttempts.has(attempt.questionId)) {
      firstAttempts.set(attempt.questionId, attempt);
    }
  }

  const steps: DrillStep[] = questions.map((question) => ({
    question,
    attempt: firstAttempts.get(question.id) ?? null,
  }));

  const summary: DrillSummary = { correct: 0, partial: 0, incorrect: 0, grading: 0, failed: 0, total: steps.length };
  for (const step of steps) {
    const outcome = stepOutcome(step);
    if (outcome) {
      summary[outcome] += 1;
    }
  }

  const current = steps.find((step) => step.attempt === null) ?? null;
  return {
    steps,
    currentQuestion: current?.question ?? null,
    answeredCount: steps.filter((step) => step.attempt !== null).length,
    completed: current === null,
    summary,
    gradingAttemptIds: steps.flatMap((step) =>
      step.attempt && stepOutcome(step) === "grading" ? [step.attempt.id] : [],
    ),
  };
}
