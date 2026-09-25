import { calendarDate, type ScheduledReview } from "./review-schedule";

export type CalendarDay = {
  /** `YYYY-MM-DD` in the calendar's time zone. */
  date: string;
  dayOfMonth: number;
  isToday: boolean;
  /** Reviews on this date, in the order given (syllabus order). */
  reviews: ScheduledReview[];
};

export type ReviewCalendarMonth = {
  /** e.g. "September 2026". */
  label: string;
  /** Monday-first weeks; `null` pads the days outside this month. */
  weeks: (CalendarDay | null)[][];
  /** Reviews that fell due before today. They'd sit in past days, so they're surfaced separately. */
  overdue: ScheduledReview[];
};

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

/**
 * The month `monthOffset` months from the current one, in `timeZone`, laid
 * out as Monday-first weeks with each review on its calendar date. Reviews
 * due before today are returned as `overdue` rather than placed in past days;
 * reviews due earlier today sit on today.
 */
export function buildReviewCalendar(
  reviews: ScheduledReview[],
  { now, timeZone, monthOffset = 0 }: { now: Date; timeZone: string; monthOffset?: number },
): ReviewCalendarMonth {
  const today = calendarDate(now, timeZone);
  const [todayYear, todayMonth] = today.split("-").map(Number);

  // Calendar-date arithmetic in UTC, where no day is ever skipped or repeated.
  const firstOfMonth = new Date(Date.UTC(todayYear, todayMonth - 1 + monthOffset, 1));
  const year = firstOfMonth.getUTCFullYear();
  const month = firstOfMonth.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const overdue: ScheduledReview[] = [];
  const byDate = new Map<string, ScheduledReview[]>();
  for (const review of reviews) {
    const date = calendarDate(new Date(review.dueAt), timeZone);
    if (date < today) {
      overdue.push(review);
    } else {
      byDate.set(date, [...(byDate.get(date) ?? []), review]);
    }
  }

  // getUTCDay counts from Sunday (0); shift so Monday leads the week.
  const leadingDays = (firstOfMonth.getUTCDay() + 6) % 7;
  const cells: (CalendarDay | null)[] = Array.from({ length: leadingDays }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${pad(year, 4)}-${pad(month + 1)}-${pad(day)}`;
    cells.push({ date, dayOfMonth: day, isToday: date === today, reviews: byDate.get(date) ?? [] });
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (CalendarDay | null)[][] = [];
  for (let start = 0; start < cells.length; start += 7) {
    weeks.push(cells.slice(start, start + 7));
  }

  const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    firstOfMonth,
  );

  return { label, weeks, overdue };
}
