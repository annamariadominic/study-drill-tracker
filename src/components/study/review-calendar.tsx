"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { buildReviewCalendar, type CalendarDay, type ReviewCalendarMonth } from "@/lib/syllabus/review-calendar";
import type { ScheduledReview } from "@/lib/syllabus/review-schedule";
import { cn } from "@/lib/utils";
import { ReviewRows } from "./review-schedule-list";
import { useLearnerTimeZone } from "./use-learner-time-zone";

const WEEKDAYS = [
  ["M", "Monday"],
  ["T", "Tuesday"],
  ["W", "Wednesday"],
  ["T", "Thursday"],
  ["F", "Friday"],
  ["S", "Saturday"],
  ["S", "Sunday"],
] as const;

/** How many Concept names a day shows on wide screens before "+N more". */
const NAMES_PER_DAY = 2;

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** e.g. "Friday, September 25". */
function longDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/**
 * Scheduled reviews on a month grid. Starts on the current month; picking a
 * day lists its reviews below the grid.
 */
export function ReviewCalendar({ reviews, now }: { reviews: ScheduledReview[]; now: string }) {
  const timeZone = useLearnerTimeZone();
  // An offset from the current month rather than a fixed month, so it stays
  // right when the render switches from the server's time zone to the learner's.
  const [monthOffset, setMonthOffset] = useState(0);
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const calendar = buildReviewCalendar(reviews, { now: new Date(now), timeZone, monthOffset });
  const selected = selectedDay(calendar, pickedDate);

  function showMonth(offset: number) {
    setMonthOffset(offset);
    setPickedDate(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {calendar.overdue.length > 0 ? (
        <div className="flex flex-col gap-2 border-l-2 border-accent py-1 pl-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
          <p className="text-sm text-text">
            {plural(calendar.overdue.length, "Concept")} overdue from before today.
          </p>
          <Link
            href="/study/due"
            className="group inline-flex items-center gap-1 rounded-[2px] text-xs font-medium text-accent hover:text-accent-strong"
          >
            Review now
            <ChevronRight aria-hidden className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between gap-4 border-b border-line pb-2">
          <h2 className="font-serif text-lg text-text" aria-live="polite">
            {calendar.label}
          </h2>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => showMonth(monthOffset - 1)}
              disabled={monthOffset === 0}
              aria-label="Previous month"
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => showMonth(monthOffset + 1)}
              aria-label="Next month"
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>

        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">Reviews scheduled in {calendar.label}</caption>
          <thead>
            <tr>
              {WEEKDAYS.map(([short, long]) => (
                <th key={long} scope="col" className="pb-2 text-center text-xs font-normal text-faint">
                  <abbr title={long} className="no-underline">
                    {short}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendar.weeks.map((week, index) => (
              <tr key={index}>
                {week.map((day, dayIndex) => (
                  <td key={day?.date ?? `pad-${dayIndex}`} className="border border-line p-0 align-top">
                    {day ? (
                      <DayCell day={day} selected={day.date === selected?.date} onSelect={setPickedDate} />
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-live="polite">
        {selected ? (
          <>
            <h3 className="flex flex-wrap items-baseline gap-x-2 border-b border-line pb-2 font-serif text-lg text-text">
              {selected.isToday ? "Today" : longDate(selected.date)}
              {selected.isToday ? <span className="font-sans text-xs text-muted">{longDate(selected.date)}</span> : null}
              <span className="font-sans text-xs tabular-nums text-faint">{plural(selected.reviews.length, "Concept")}</span>
            </h3>
            <ReviewRows reviews={selected.reviews} />
          </>
        ) : (
          <p className="text-sm text-muted">No reviews scheduled in {calendar.label}.</p>
        )}
      </section>
    </div>
  );
}

/** The picked day if it has reviews, otherwise the first day with reviews from today on. */
function selectedDay(calendar: ReviewCalendarMonth, pickedDate: string | null): CalendarDay | undefined {
  const withReviews = calendar.weeks.flat().filter((day): day is CalendarDay => day !== null && day.reviews.length > 0);
  return withReviews.find((day) => day.date === pickedDate) ?? withReviews[0];
}

function DayCell({
  day,
  selected,
  onSelect,
}: {
  day: CalendarDay;
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  const count = day.reviews.length;
  const number = (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
        day.isToday ? "bg-accent font-medium text-accent-ink" : count > 0 ? "text-text" : "text-faint",
      )}
    >
      {day.dayOfMonth}
    </span>
  );
  const cellClass = "flex min-h-14 w-full flex-col items-start gap-1 p-1 text-left sm:min-h-24 sm:p-1.5";

  if (count === 0) {
    return (
      <div className={cellClass}>
        {number}
        {day.isToday ? <span className="sr-only">Today, no reviews</span> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(day.date)}
      aria-pressed={selected}
      aria-label={`${day.isToday ? "Today, " : ""}${longDate(day.date)}: ${plural(count, "review")}`}
      className={cn(
        cellClass,
        "transition-colors duration-150",
        selected ? "bg-accent-wash" : "hover:bg-surface",
      )}
    >
      {number}
      <span className="rounded-full bg-accent-wash px-1.5 text-[11px] font-medium tabular-nums text-accent-strong sm:hidden">
        {count}
      </span>
      <span className="hidden w-full min-w-0 flex-col gap-0.5 sm:flex">
        {day.reviews.slice(0, NAMES_PER_DAY).map((review) => (
          <span key={review.conceptId} className="truncate text-[11px] leading-tight text-text">
            {review.conceptName}
          </span>
        ))}
        {count > NAMES_PER_DAY ? (
          <span className="text-[11px] leading-tight text-muted">+{count - NAMES_PER_DAY} more</span>
        ) : null}
      </span>
    </button>
  );
}
