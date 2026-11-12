import { EASE_DEFAULT } from "@/lib/study/scheduling";
import type { SyllabusRepository } from "./repository";
import { calendarDate } from "./review-schedule";
import type { StudiedConcept } from "./types";

export const MIN_REVIEWS_PER_DAY = 1;
export const MAX_REVIEWS_PER_DAY = 100;

export type BacklogMove = { conceptId: string; nextDueAt: string };

export type BacklogSpread = {
  moves: BacklogMove[];
  /** How many calendar days, from today, the backlog now covers. 0 when there was nothing to move. */
  days: number;
};

/**
 * How many of `dueAts` fell due on an earlier calendar day than `now` in
 * `timeZone`. A review that came due today isn't a backlog yet, so a spread
 * that has just put reviews on today doesn't offer to spread them again.
 */
export function countDueBeforeToday(dueAts: string[], { now, timeZone }: { now: Date; timeZone: string }): number {
  const today = calendarDate(now, timeZone);
  return dueAts.filter((dueAt) => calendarDate(new Date(dueAt), timeZone) < today).length;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Re-dates every Concept already due so that no day, from today on, holds more
 * than `perDay` reviews, counting the reviews already scheduled on it. The
 * weakest Concepts (shortest interval) come back first, then the longest
 * overdue. Only due dates move: interval and ease are kept, so what was
 * learned before falling behind still shapes later reviews.
 */
export function planBacklogSpread(
  studiedConcepts: StudiedConcept[],
  { perDay, timeZone, now }: { perDay: number; timeZone: string; now: Date },
): BacklogSpread {
  const scheduled = studiedConcepts.flatMap(({ concept }) =>
    concept.nextReviewDueAt === null ? [] : [{ concept, dueAt: new Date(concept.nextReviewDueAt) }],
  );
  const overdue = scheduled
    .filter(({ dueAt }) => dueAt.getTime() <= now.getTime())
    .sort(
      (a, b) =>
        (a.concept.reviewIntervalDays ?? 1) - (b.concept.reviewIntervalDays ?? 1) ||
        a.dueAt.getTime() - b.dueAt.getTime(),
    );

  const alreadyBooked = new Map<string, number>();
  for (const { dueAt } of scheduled) {
    if (dueAt.getTime() > now.getTime()) {
      const date = calendarDate(dueAt, timeZone);
      alreadyBooked.set(date, (alreadyBooked.get(date) ?? 0) + 1);
    }
  }

  const moves: BacklogMove[] = [];
  let day = 0;
  while (moves.length < overdue.length) {
    const dueAt = addDays(now, day);
    const free = perDay - (alreadyBooked.get(calendarDate(dueAt, timeZone)) ?? 0);
    for (const { concept } of overdue.slice(moves.length, moves.length + Math.max(0, free))) {
      moves.push({ conceptId: concept.id, nextDueAt: dueAt.toISOString() });
    }
    day += 1;
  }

  return { moves, days: day };
}

/** Spreads the due backlog (see `planBacklogSpread`) and saves the new due dates. */
export async function spreadBacklog(
  repo: SyllabusRepository,
  options: { perDay: number; timeZone: string },
  now: Date = new Date(),
): Promise<BacklogSpread> {
  const studiedConcepts = await repo.listStudiedConcepts();
  const spread = planBacklogSpread(studiedConcepts, { ...options, now });
  const byId = new Map(studiedConcepts.map(({ concept }) => [concept.id, concept]));
  await Promise.all(
    spread.moves.map(({ conceptId, nextDueAt }) => {
      const concept = byId.get(conceptId)!;
      return repo.updateConceptReviewSchedule(conceptId, {
        intervalDays: concept.reviewIntervalDays ?? 1,
        easeFactor: concept.reviewEaseFactor ?? EASE_DEFAULT,
        nextDueAt,
      });
    }),
  );
  return spread;
}
