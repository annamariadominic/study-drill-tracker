"use client";

import { CalendarSync } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PendingSubmit } from "@/components/ui/pending-submit";
import { MAX_REVIEWS_PER_DAY, MIN_REVIEWS_PER_DAY } from "@/lib/syllabus/spread-backlog";
import { useLearnerTimeZone } from "./use-learner-time-zone";

const DEFAULT_PER_DAY = 5;

function reviews(count: number) {
  return `${count} review${count === 1 ? "" : "s"}`;
}

/**
 * For catching up after falling behind: re-dates everything due now over the
 * coming days, at most so many reviews a day. Kept closed until asked for, and
 * says what it will move before anything does.
 */
export function SpreadBacklog({ dueCount, view }: { dueCount: number; view: string }) {
  const timeZone = useLearnerTimeZone();
  const [perDay, setPerDay] = useState(String(DEFAULT_PER_DAY));
  const limit = Number(perDay);
  const valid = Number.isInteger(limit) && limit >= MIN_REVIEWS_PER_DAY && limit <= MAX_REVIEWS_PER_DAY;

  return (
    <details className="group mb-8 rounded-control border border-line px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted select-none hover:text-text [&::-webkit-details-marker]:hidden">
        <CalendarSync aria-hidden className="size-4 shrink-0" />
        <span>
          Fallen behind? <span className="text-text">Spread the {reviews(dueCount)} due now</span> over the coming days.
        </span>
      </summary>
      <form method="post" action="/api/reviews/spread" className="flex flex-col gap-4 pt-4">
        <input type="hidden" name="timeZone" value={timeZone} />
        <input type="hidden" name="view" value={view} />
        <Field
          label="Reviews a day, at most"
          htmlFor="spread-backlog-per-day"
          hint="Reviews already on the calendar count toward each day's limit and stay where they are."
          className="max-w-56"
        >
          <Input
            id="spread-backlog-per-day"
            name="perDay"
            type="number"
            inputMode="numeric"
            min={MIN_REVIEWS_PER_DAY}
            max={MAX_REVIEWS_PER_DAY}
            step={1}
            required
            value={perDay}
            onChange={(event) => setPerDay(event.target.value)}
          />
        </Field>
        <p className="max-w-prose text-sm text-muted">
          {valid ? (
            <>
              Moves all {reviews(dueCount)} due now onto today and the days after, with no day holding more than{" "}
              {reviews(limit)}. Shaky Concepts come back first. How well you know each Concept is kept, so later reviews
              stay spaced the same way.
            </>
          ) : (
            <>
              Choose a whole number from {MIN_REVIEWS_PER_DAY} to {MAX_REVIEWS_PER_DAY}.
            </>
          )}
        </p>
        <div>
          <PendingSubmit size="sm" pendingLabel="Rescheduling…">
            Spread {reviews(dueCount)}
          </PendingSubmit>
        </div>
      </form>
    </details>
  );
}
