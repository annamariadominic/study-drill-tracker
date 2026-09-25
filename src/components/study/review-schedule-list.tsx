import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/feedback";
import type { ReviewSchedule, ScheduledReview } from "@/lib/syllabus/review-schedule";
import { cn } from "@/lib/utils";

/**
 * The learner's review schedule as a grouped chronological list: what's due
 * now, set apart, then each later calendar date in order.
 */
export function ReviewScheduleList({
  schedule,
  hasStudiedConcepts,
}: {
  schedule: ReviewSchedule;
  hasStudiedConcepts: boolean;
}) {
  const { dueNow, upcoming } = schedule;

  if (dueNow.length === 0 && upcoming.length === 0) {
    return hasStudiedConcepts ? (
      <EmptyState title="No reviews scheduled">None of your studied Concepts has a review date yet.</EmptyState>
    ) : (
      <EmptyState title="Nothing scheduled yet">
        Mark a Concept as studied and its reviews will show up here.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ScheduleGroup
        id="review-schedule-due-now"
        title="Due now"
        count={dueNow.length}
        emphasis
        trailing={
          dueNow.length > 0 ? (
            <Link
              href="/study/due"
              className="group inline-flex items-center gap-1 rounded-[2px] text-xs font-medium text-accent hover:text-accent-strong"
            >
              Review now
              <ChevronRight aria-hidden className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          ) : null
        }
      >
        {dueNow.length > 0 ? (
          <ReviewRows
            reviews={dueNow.map((review) => ({
              ...review,
              note: review.dueDateLabel === "Today" ? "Due today" : `Due ${review.dueDateLabel}`,
            }))}
          />
        ) : (
          <p className="py-3 text-sm text-muted">Nothing due right now.</p>
        )}
      </ScheduleGroup>

      {upcoming.length > 0 ? (
        upcoming.map((group) => (
          <ScheduleGroup
            key={group.date}
            id={`review-schedule-${group.date}`}
            title={group.label}
            subtitle={group.label === group.shortDate ? undefined : group.shortDate}
            count={group.reviews.length}
          >
            <ReviewRows reviews={group.reviews} />
          </ScheduleGroup>
        ))
      ) : (
        <p className="text-sm text-muted">Nothing else scheduled yet.</p>
      )}
    </div>
  );
}

function ScheduleGroup({
  id,
  title,
  subtitle,
  count,
  emphasis = false,
  trailing,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  count: number;
  emphasis?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn(emphasis && "border-l-2 border-accent pl-4")}>
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h3 id={id} className="flex flex-wrap items-baseline gap-x-2 font-serif text-lg text-text">
          {title}
          {subtitle ? <span className="font-sans text-xs text-muted">{subtitle}</span> : null}
          <span className="font-sans text-xs tabular-nums text-faint">
            <span className="sr-only">, </span>
            {count}
            <span className="sr-only"> {count === 1 ? "Concept" : "Concepts"}</span>
          </span>
        </h3>
        {trailing}
      </div>
      {children}
    </section>
  );
}

/** One row per Concept; `note` adds a short trailing detail, e.g. when a due review fell due. */
export function ReviewRows({ reviews }: { reviews: (ScheduledReview & { note?: string })[] }) {
  return (
    <ul className="divide-y divide-line">
      {reviews.map((review) => (
        <li
          key={review.conceptId}
          className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
        >
          <span className="min-w-0 text-text">{review.conceptName}</span>
          <span className="shrink-0 text-xs text-muted">
            {review.domainName} › {review.subjectName}
            {review.note ? <span className="text-faint"> · {review.note}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
