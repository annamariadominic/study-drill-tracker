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
  /** The Concept's Subject, which a scenario tries to vary. */
  subjectId: string;
  /** null for a Concept that has never been scheduled. */
  schedule: ReviewScheduleState | null;
};

export type ComposedQuestion = {
  /** One Concept for recall and flashcard; two or more for a scenario. */
  conceptIds: string[];
  type: QuestionType;
};

export const DEFAULT_MAX_QUESTIONS = 10;

/** The most Concepts one scenario Question combines. */
export const MAX_SCENARIO_CONCEPTS = 3;

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
 * The Concepts a Drill's scenario Question combines, drawn from the ranked
 * in-Domain candidates, or none if there aren't two to combine.
 *
 * It takes the best-ranked Concept from each Subject first, so a scenario
 * spans Subjects wherever the Domain offers more than one, then tops up in
 * rank order. Weak and never-attempted Concepts rank first, so they're as
 * eligible here as anywhere: a scenario has no minimum maturity.
 */
function scenarioConceptIds(ranked: DrillCandidate[]): string[] {
  const chosen = new Set<DrillCandidate>();
  const subjectsCovered = new Set<string>();
  for (const candidate of ranked) {
    if (chosen.size < MAX_SCENARIO_CONCEPTS && !subjectsCovered.has(candidate.subjectId)) {
      chosen.add(candidate);
      subjectsCovered.add(candidate.subjectId);
    }
  }
  for (const candidate of ranked) {
    if (chosen.size < MAX_SCENARIO_CONCEPTS) {
      chosen.add(candidate);
    }
  }
  if (chosen.size < 2) {
    return [];
  }
  return ranked.filter((candidate) => chosen.has(candidate)).map((candidate) => candidate.conceptId);
}

/** Recall and flashcard Questions for the ranked Concepts, as many as fit the room. */
function perConceptQuestions(
  ranked: { candidate: DrillCandidate; strength: ConceptStrength }[],
  room: number,
): ComposedQuestion[] {
  const questions: ComposedQuestion[] = [];
  for (const { candidate, strength } of ranked) {
    const types = QUESTION_TYPES_BY_STRENGTH[strength];
    // A Concept is included whole or not at all, so a Drill never stops
    // mid-Concept when it runs out of room.
    if (questions.length + types.length > room) {
      break;
    }
    for (const type of types) {
      questions.push({ conceptIds: [candidate.conceptId], type });
    }
  }
  return questions;
}

/**
 * Decides which Concepts a Drill covers and with what mix of Question types.
 * Pure: the caller supplies the candidate Concepts (the due-list, or whatever
 * a random Drill is scoped to) and turns the result into actual Questions.
 *
 * Concepts outside the Drill's Domain are dropped before anything is chosen,
 * since a Drill — and so every scenario in it — stays within one Domain
 * (ADR 0001).
 *
 * Where there are two or more candidates, the Drill closes with one scenario
 * Question combining some of them, after the recall and flashcard Questions
 * (ADR 0008).
 * Its slot is kept back from the per-Concept Questions, unless that would
 * leave room for none of them, in which case the scenario is dropped.
 */
export function composeDrill(input: {
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

  const scenario = scenarioConceptIds(ranked.map(({ candidate }) => candidate));
  if (scenario.length > 0) {
    const alongsideScenario = perConceptQuestions(ranked, maxQuestions - 1);
    if (alongsideScenario.length > 0) {
      return [...alongsideScenario, { conceptIds: scenario, type: "scenario" }];
    }
  }
  return perConceptQuestions(ranked, maxQuestions);
}
