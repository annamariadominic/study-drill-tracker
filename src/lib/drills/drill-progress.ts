import type { Attempt, Correctness, Question } from "@/lib/questions/types";

export type DrillStep = {
  question: Question;
  /** null until the Question has been answered. */
  attempt: Attempt | null;
};

export type DrillSummary = Record<Correctness, number> & { total: number };

export type DrillProgress = {
  steps: DrillStep[];
  /** The Question to ask next, or null once the Drill is finished. */
  currentQuestion: Question | null;
  answeredCount: number;
  completed: boolean;
  summary: DrillSummary;
};

/**
 * Where a Drill has got to, given its Questions and the Attempts recorded
 * against them. A Question is answered once it has an Attempt; only the first
 * Attempt counts, so re-submitting can't re-write the Drill's outcome.
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

  const summary: DrillSummary = { correct: 0, partial: 0, incorrect: 0, total: steps.length };
  for (const step of steps) {
    if (step.attempt) {
      summary[step.attempt.correctness] += 1;
    }
  }

  const current = steps.find((step) => step.attempt === null) ?? null;
  return {
    steps,
    currentQuestion: current?.question ?? null,
    answeredCount: steps.filter((step) => step.attempt !== null).length,
    completed: current === null,
    summary,
  };
}
