"use client";

import { groupReviewSchedule, type ScheduledReview } from "@/lib/syllabus/review-schedule";
import { ReviewCalendar } from "./review-calendar";
import { ReviewScheduleList } from "./review-schedule-list";
import { useLearnerTimeZone } from "./use-learner-time-zone";

export type ReviewScheduleView = "list" | "calendar";

export function ReviewSchedule({
  reviews,
  now,
  hasStudiedConcepts,
  view = "list",
}: {
  /** Studied Concepts with a next review date, in syllabus order. */
  reviews: ScheduledReview[];
  /** When the page was rendered, as an ISO timestamp, so due-now matches the server's due-list. */
  now: string;
  hasStudiedConcepts: boolean;
  view?: ReviewScheduleView;
}) {
  const timeZone = useLearnerTimeZone();

  // With nothing scheduled, both views show the list's empty state.
  if (view === "calendar" && reviews.length > 0) {
    return <ReviewCalendar reviews={reviews} now={now} />;
  }

  const schedule = groupReviewSchedule(reviews, { now: new Date(now), timeZone });
  return <ReviewScheduleList schedule={schedule} hasStudiedConcepts={hasStudiedConcepts} />;
}
