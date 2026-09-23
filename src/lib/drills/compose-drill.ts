import type { QuestionType } from "@/lib/questions/types";
import { EASE_DEFAULT, type ReviewScheduleState } from "@/lib/study/scheduling";

/**
 * How well a Concept is holding up, read off its review schedule: the interval
 * only grows when Attempts go well, and the ease factor falls when they don't.
 */
export type ConceptStrength = "weak" | "developing" | "strong";

export type DrillCandidate = {
  conceptId: string;
  /** The Domain the Concept's Subject belongs to. */
  domainId: string;
  /** null for a Concept that has never been scheduled. */
  schedule: ReviewScheduleState | null;
};

export type ComposedQuestion = {
  /** One Concept for recall and flashcard; two or more for a scenario. */
  conceptIds: string[];
  type: QuestionType;
};

export const DEFAULT_MAX_QUESTIONS = 10;

/** At or above this interval a Concept has survived several successful reviews. */
const STRONG_INTERVAL_DAYS = 21;

/**
 * Weaker Concepts earn a fuller workout: recall (produce the answer) plus a
 * flashcard to reinforce it. A developing Concept gets recall alone, and a
 * strong one only a light recognition check.
 */
const QUESTION_TYPES_BY_STRENGTH: Record<ConceptStrength, QuestionType[]> = {
  weak: ["recall", "flashcard"],
  developing: ["recall"],
  strong: ["flashcard"],
};

const STRENGTH_ORDER: ConceptStrength[] = ["weak", "developing", "strong"];

export function conceptStrength(schedule: ReviewScheduleState | null): ConceptStrength {
  if (schedule === null) {
    return "weak";
  }
  // An ease factor below where it started means Attempts have been going wrong
  // or being guessed (ADR 0002).
  if (schedule.intervalDays <= 1 || schedule.easeFactor < EASE_DEFAULT) {
    return "weak";
  }
  if (schedule.intervalDays < STRONG_INTERVAL_DAYS) {
    return "developing";
  }
  return "strong";
}

/** An unscheduled Concept has been waiting longest, so it sorts first. */
function dueTime(candidate: DrillCandidate): number {
  return candidate.schedule ? Date.parse(candidate.schedule.nextDueAt) : 0;
}

/**
 * Decides which due Concepts a Drill covers and with what mix of Question
 * types. Pure: the caller supplies the due Concepts and turns the result into
 * actual Questions.
 *
 * Concepts outside the Drill's Domain are dropped, since a Drill stays within
 * one Domain (ADR 0001).
 */
export function composeDueDrill(input: {
  domainId: string;
  candidates: DrillCandidate[];
  maxQuestions?: number;
}): ComposedQuestion[] {
  const maxQuestions = input.maxQuestions ?? DEFAULT_MAX_QUESTIONS;

  const ranked = input.candidates
    .filter((candidate) => candidate.domainId === input.domainId)
    .map((candidate) => ({ candidate, strength: conceptStrength(candidate.schedule) }))
    .sort((a, b) => {
      const byStrength =
        STRENGTH_ORDER.indexOf(a.strength) - STRENGTH_ORDER.indexOf(b.strength);
      if (byStrength !== 0) {
        return byStrength;
      }
      const byDueAt = dueTime(a.candidate) - dueTime(b.candidate);
      if (byDueAt !== 0) {
        return byDueAt;
      }
      return a.candidate.conceptId.localeCompare(b.candidate.conceptId);
    });

  const questions: ComposedQuestion[] = [];
  for (const { candidate, strength } of ranked) {
    const types = QUESTION_TYPES_BY_STRENGTH[strength];
    // A Concept is included whole or not at all, so a Drill never stops
    // mid-Concept when it runs out of room.
    if (questions.length + types.length > maxQuestions) {
      break;
    }
    for (const type of types) {
      questions.push({ conceptIds: [candidate.conceptId], type });
    }
  }
  return questions;
}
