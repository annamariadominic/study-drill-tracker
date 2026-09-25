"use client";

import { useSyncExternalStore } from "react";
import { groupReviewSchedule, type ScheduledReview } from "@/lib/syllabus/review-schedule";
import { ReviewScheduleList } from "./review-schedule-list";

/**
 * The app has no stored time zone, and Concept review dates are UTC
 * timestamps, so calendar dates are grouped in the learner's browser time
 * zone. The server render (and hydration) uses UTC; the browser then regroups
 * in its own zone.
 */
const SERVER_TIME_ZONE = "UTC";

function subscribe() {
  // The browser's time zone doesn't change while the page is open.
  return () => {};
}

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || SERVER_TIME_ZONE;
}

function serverTimeZone() {
  return SERVER_TIME_ZONE;
}

export function ReviewSchedule({
  reviews,
  now,
  hasStudiedConcepts,
}: {
  /** Studied Concepts with a next review date, in syllabus order. */
  reviews: ScheduledReview[];
  /** When the page was rendered, as an ISO timestamp, so due-now matches the server's due-list. */
  now: string;
  hasStudiedConcepts: boolean;
}) {
  const timeZone = useSyncExternalStore(subscribe, browserTimeZone, serverTimeZone);
  const schedule = groupReviewSchedule(reviews, { now: new Date(now), timeZone });
  return <ReviewScheduleList schedule={schedule} hasStudiedConcepts={hasStudiedConcepts} />;
}
