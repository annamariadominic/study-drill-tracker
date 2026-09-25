import type { StudiedConcept } from "./types";

/** One Concept's next review, with the names needed to show it. Plain data, so it can cross to the client. */
export type ScheduledReview = {
  conceptId: string;
  conceptName: string;
  subjectName: string;
  domainName: string;
  /** The Concept's `nextReviewDueAt` timestamp. */
  dueAt: string;
};

export type DueNowReview = ScheduledReview & {
  /** "Today" when due earlier today, otherwise the short date it fell due, e.g. "Sep 20". */
  dueDateLabel: string;
};

export type UpcomingReviewDate = {
  /** The calendar date, `YYYY-MM-DD` in the grouping time zone. */
  date: string;
  /** "Later today", "Tomorrow", or the short date. */
  label: string;
  /** The short date, e.g. "Sep 27", shown alongside a relative label. */
  shortDate: string;
  reviews: ScheduledReview[];
};

export type ReviewSchedule = {
  dueNow: DueNowReview[];
  upcoming: UpcomingReviewDate[];
};

/**
 * The studied Concepts that have a review scheduled, in the order they're
 * given (the syllabus's Domain → Subject → Concept order from
 * `listStudiedConcepts`).
 */
export function listScheduledReviews(studiedConcepts: StudiedConcept[]): ScheduledReview[] {
  return studiedConcepts.flatMap(({ concept, subject, domain }) =>
    concept.status === "studied" && concept.nextReviewDueAt !== null
      ? [
          {
            conceptId: concept.id,
            conceptName: concept.name,
            subjectName: subject.name,
            domainName: domain.name,
            dueAt: concept.nextReviewDueAt,
          },
        ]
      : [],
  );
}

/**
 * `YYYY-MM-DD` for the calendar date `instant` falls on in `timeZone`. Built
 * from the formatter's parts rather than its formatted string, whose layout
 * varies by locale data and browser.
 */
export function calendarDate(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year").padStart(4, "0")}-${part("month").padStart(2, "0")}-${part("day").padStart(2, "0")}`;
}

/** Whole days from calendar date `from` to calendar date `to`, both `YYYY-MM-DD`. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** "Sep 27", or "Sep 27, 2027" outside the current year. */
function shortDate(date: string, today: string): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Splits scheduled reviews into what's due now (due at or before `now`, the
 * same rule as the due-list) and future reviews grouped by the calendar date
 * they fall on in `timeZone`, earliest date first. Within each group the input
 * order is kept, so pass reviews in syllabus order for a stable list.
 */
export function groupReviewSchedule(
  reviews: ScheduledReview[],
  { now, timeZone }: { now: Date; timeZone: string },
): ReviewSchedule {
  const today = calendarDate(now, timeZone);
  const dueNow: DueNowReview[] = [];
  const upcomingByDate = new Map<string, ScheduledReview[]>();

  for (const review of reviews) {
    const dueAt = new Date(review.dueAt);
    const date = calendarDate(dueAt, timeZone);
    if (dueAt.getTime() <= now.getTime()) {
      dueNow.push({ ...review, dueDateLabel: date === today ? "Today" : shortDate(date, today) });
    } else {
      const group = upcomingByDate.get(date) ?? [];
      group.push(review);
      upcomingByDate.set(date, group);
    }
  }

  const upcoming = [...upcomingByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, dateReviews]) => {
      const days = daysBetween(today, date);
      const short = shortDate(date, today);
      return {
        date,
        label: days <= 0 ? "Later today" : days === 1 ? "Tomorrow" : short,
        shortDate: short,
        reviews: dateReviews,
      };
    });

  return { dueNow, upcoming };
}
