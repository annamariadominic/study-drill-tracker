import type { QuestionType } from "@/lib/questions/types";

/**
 * How well a Concept is holding up, read off its review schedule: the interval
 * only grows when Attempts go well, and the ease factor falls when they don't.
 */
export type ConceptStrength = "weak" | "developing" | "strong";

export type DrillCandidate = {
  conceptId: string;
  domainId: string;
  reviewIntervalDays: number | null;
  reviewEaseFactor: number | null;
  dueAt: string;
};

export type ComposedQuestion = {
  conceptId: string;
  type: QuestionType;
};

export const DEFAULT_MAX_QUESTIONS = 10;

/** Below this ease factor a Concept has been got wrong more often than not. */
const SHAKY_EASE_FACTOR = 2.5;
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

export function conceptStrength(concept: {
  reviewIntervalDays: number | null;
  reviewEaseFactor: number | null;
}): ConceptStrength {
  const { reviewIntervalDays, reviewEaseFactor } = concept;
  if (reviewIntervalDays === null || reviewEaseFactor === null) {
    return "weak";
  }
  if (reviewIntervalDays <= 1 || reviewEaseFactor < SHAKY_EASE_FACTOR) {
    return "weak";
  }
  if (reviewIntervalDays < STRONG_INTERVAL_DAYS) {
    return "developing";
  }
  return "strong";
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
    .map((candidate) => ({ candidate, strength: conceptStrength(candidate) }))
    .sort((a, b) => {
      const byStrength =
        STRENGTH_ORDER.indexOf(a.strength) - STRENGTH_ORDER.indexOf(b.strength);
      if (byStrength !== 0) {
        return byStrength;
      }
      const byDueAt = Date.parse(a.candidate.dueAt) - Date.parse(b.candidate.dueAt);
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
      questions.push({ conceptId: candidate.conceptId, type });
    }
  }
  return questions;
}
