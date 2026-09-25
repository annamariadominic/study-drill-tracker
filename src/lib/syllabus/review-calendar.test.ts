import { describe, expect, it } from "vitest";
import { buildReviewCalendar, type CalendarDay } from "./review-calendar";
import type { ScheduledReview } from "./review-schedule";

const NOW = new Date("2026-09-24T15:00:00Z");

function review(conceptName: string, dueAt: string): ScheduledReview {
  return {
    conceptId: conceptName,
    conceptName,
    subjectName: "System Design",
    domainName: "Software Engineering",
    dueAt,
  };
}

function days(weeks: (CalendarDay | null)[][]) {
  return weeks.flat().filter((day): day is CalendarDay => day !== null);
}

function day(weeks: (CalendarDay | null)[][], date: string) {
  return days(weeks).find((d) => d.date === date);
}

describe("buildReviewCalendar", () => {
  it("lays out the current month as Monday-first weeks", () => {
    const { label, weeks } = buildReviewCalendar([], { now: NOW, timeZone: "UTC" });

    expect(label).toBe("September 2026");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    // Sep 1 2026 is a Tuesday, so the first week starts with Monday padded out.
    expect(weeks[0].slice(0, 2).map((d) => d?.date ?? null)).toEqual([null, "2026-09-01"]);
    // Sep 30 is a Wednesday, so the last week ends with Thursday to Sunday padded out.
    expect(weeks.at(-1)?.map((d) => d?.date ?? null)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      null,
      null,
      null,
      null,
    ]);
    expect(days(weeks).map((d) => d.dayOfMonth)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(days(weeks).filter((d) => d.isToday).map((d) => d.date)).toEqual(["2026-09-24"]);
  });

  it("puts each review on its calendar date, keeping the given order within a day", () => {
    const { weeks } = buildReviewCalendar(
      [
        review("Load balancing", "2026-09-27T10:00:00Z"),
        review("Prompt chaining", "2026-09-25T10:00:00Z"),
        review("Retries", "2026-09-27T06:00:00Z"),
      ],
      { now: NOW, timeZone: "UTC" },
    );

    expect(day(weeks, "2026-09-25")?.reviews.map((r) => r.conceptName)).toEqual(["Prompt chaining"]);
    expect(day(weeks, "2026-09-27")?.reviews.map((r) => r.conceptName)).toEqual(["Load balancing", "Retries"]);
    expect(day(weeks, "2026-09-26")?.reviews).toEqual([]);
  });

  it("surfaces reviews due before today as overdue, and keeps reviews due earlier today on today", () => {
    const { weeks, overdue } = buildReviewCalendar(
      [review("Overdue", "2026-09-20T10:00:00Z"), review("Earlier today", "2026-09-24T08:00:00Z")],
      { now: NOW, timeZone: "UTC" },
    );

    expect(overdue.map((r) => r.conceptName)).toEqual(["Overdue"]);
    expect(day(weeks, "2026-09-20")?.reviews).toEqual([]);
    expect(day(weeks, "2026-09-24")?.reviews.map((r) => r.conceptName)).toEqual(["Earlier today"]);
  });

  it("moves between months, including across a year", () => {
    const reviews = [review("Next month", "2026-10-02T10:00:00Z"), review("Next year", "2027-01-05T10:00:00Z")];

    const october = buildReviewCalendar(reviews, { now: NOW, timeZone: "UTC", monthOffset: 1 });
    expect(october.label).toBe("October 2026");
    expect(days(october.weeks).some((d) => d.isToday)).toBe(false);
    expect(day(october.weeks, "2026-10-02")?.reviews.map((r) => r.conceptName)).toEqual(["Next month"]);

    const january = buildReviewCalendar(reviews, { now: NOW, timeZone: "UTC", monthOffset: 4 });
    expect(january.label).toBe("January 2027");
    expect(day(january.weeks, "2027-01-05")?.reviews.map((r) => r.conceptName)).toEqual(["Next year"]);
    expect(days(january.weeks)).toHaveLength(31);
    // Jan 1 2027 is a Friday: four padding days, Monday to Thursday.
    expect(january.weeks[0].map((d) => d?.dayOfMonth ?? null)).toEqual([null, null, null, null, 1, 2, 3]);
  });

  it("uses the time zone for today and for each review's date", () => {
    // 02:00 UTC on Sep 26 is the evening of Sep 25 in New York.
    const reviews = [review("Late evening", "2026-09-26T02:00:00Z")];

    const newYork = buildReviewCalendar(reviews, { now: NOW, timeZone: "America/New_York" });
    expect(day(newYork.weeks, "2026-09-25")?.reviews.map((r) => r.conceptName)).toEqual(["Late evening"]);

    // Just after midnight UTC on Oct 1 it's still September in New York.
    const monthEnd = buildReviewCalendar([], { now: new Date("2026-10-01T02:00:00Z"), timeZone: "America/New_York" });
    expect(monthEnd.label).toBe("September 2026");
    expect(days(monthEnd.weeks).find((d) => d.isToday)?.date).toBe("2026-09-30");
  });
});
