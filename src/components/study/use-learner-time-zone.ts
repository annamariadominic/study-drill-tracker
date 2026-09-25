import { useSyncExternalStore } from "react";

/**
 * The app has no stored time zone, and Concept review dates are UTC
 * timestamps, so calendar dates are worked out in the learner's browser time
 * zone. The server render (and hydration) uses UTC; the browser then
 * re-renders in its own zone.
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

export function useLearnerTimeZone(): string {
  return useSyncExternalStore(subscribe, browserTimeZone, serverTimeZone);
}
