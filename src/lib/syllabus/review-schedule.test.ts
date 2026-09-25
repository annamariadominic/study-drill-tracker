import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeSyllabusRepository } from "./fake-repository";
import type { SyllabusRepository } from "./repository";
import { groupReviewSchedule, listScheduledReviews, type ScheduledReview } from "./review-schedule";

function review(conceptName: string, dueAt: string, overrides: Partial<ScheduledReview> = {}): ScheduledReview {
  return {
    conceptId: conceptName,
    conceptName,
    subjectName: "System Design",
    domainName: "Software Engineering",
    dueAt,
    ...overrides,
  };
}

const NOW = new Date("2026-09-24T15:00:00Z");

describe("listScheduledReviews", () => {
  it("keeps studied Concepts with a schedule, in syllabus order, with their Subject and Domain", async () => {
    const repo: SyllabusRepository = new FakeSyllabusRepository();
    const software = await repo.createDomain({ name: "Software Engineering" });
    const systemDesign = await repo.createSubject(software.id, { name: "System Design" });
    const apiDesign = await repo.createSubject(software.id, { name: "API Design" });

    const sharding = await repo.createConcept(systemDesign.id, { name: "Sharding" }); // stays planned
    const loadBalancing = await repo.createConcept(systemDesign.id, { name: "Load balancing" });
    const caching = await repo.createConcept(systemDesign.id, { name: "Caching" });
    const idempotency = await repo.createConcept(apiDesign.id, { name: "Idempotency" });
    for (const concept of [loadBalancing, caching, idempotency]) {
      await repo.setConceptStatus(concept.id, "studied");
    }
    await repo.reorderConcepts(systemDesign.id, [caching.id, sharding.id, loadBalancing.id]);

    const reviews = listScheduledReviews(await repo.listStudiedConcepts());

    expect(reviews.map((r) => r.conceptName)).toEqual(["Caching", "Load balancing", "Idempotency"]);
    expect(reviews[2]).toMatchObject({
      conceptId: idempotency.id,
      subjectName: "API Design",
      domainName: "Software Engineering",
    });
    expect(reviews.every((r) => typeof r.dueAt === "string")).toBe(true);
  });

  it("excludes planned Concepts and studied Concepts with no next review date", async () => {
    const repo: SyllabusRepository = new FakeSyllabusRepository();
    const domain = await repo.createDomain({ name: "Software Engineering" });
    const subject = await repo.createSubject(domain.id, { name: "System Design" });
    const planned = await repo.createConcept(subject.id, { name: "Sharding" });
    const studied = await repo.setConceptStatus(
      (await repo.createConcept(subject.id, { name: "Idempotency" })).id,
      "studied",
    );

    const studiedConcepts = await repo.listStudiedConcepts();
    const unscheduled = { ...studiedConcepts[0], concept: { ...studied, id: "unscheduled", nextReviewDueAt: null } };
    const plannedEntry = { ...studiedConcepts[0], concept: planned };

    const reviews = listScheduledReviews([...studiedConcepts, unscheduled, plannedEntry]);

    expect(reviews.map((r) => r.conceptId)).toEqual([studied.id]);
  });
});

describe("groupReviewSchedule", () => {
  it("puts overdue and due-now reviews in their own group, apart from future dates", () => {
    const schedule = groupReviewSchedule(
      [
        review("Overdue", "2026-09-20T09:00:00Z"),
        review("Tomorrow", "2026-09-25T09:00:00Z"),
        review("Exactly now", NOW.toISOString()),
        review("Earlier today", "2026-09-24T08:00:00Z"),
      ],
      { now: NOW, timeZone: "UTC" },
    );

    expect(schedule.dueNow.map((r) => [r.conceptName, r.dueDateLabel])).toEqual([
      ["Overdue", "Sep 20"],
      ["Exactly now", "Today"],
      ["Earlier today", "Today"],
    ]);
    expect(schedule.upcoming.map((g) => g.reviews.map((r) => r.conceptName))).toEqual([["Tomorrow"]]);
  });

  it("groups future reviews by calendar date, earliest date first, with friendly labels", () => {
    const schedule = groupReviewSchedule(
      [
        review("Idempotency", "2026-09-29T10:00:00Z"),
        review("Load balancing", "2026-09-27T10:00:00Z"),
        review("Prompt chaining", "2026-09-25T10:00:00Z"),
        review("Later today", "2026-09-24T20:00:00Z"),
        review("Retries", "2026-09-27T06:00:00Z"),
        review("Next year", "2027-01-03T10:00:00Z"),
      ],
      { now: NOW, timeZone: "UTC" },
    );

    expect(schedule.dueNow).toEqual([]);
    expect(schedule.upcoming.map((g) => [g.date, g.label, g.shortDate])).toEqual([
      ["2026-09-24", "Later today", "Sep 24"],
      ["2026-09-25", "Tomorrow", "Sep 25"],
      ["2026-09-27", "Sep 27", "Sep 27"],
      ["2026-09-29", "Sep 29", "Sep 29"],
      ["2027-01-03", "Jan 3, 2027", "Jan 3, 2027"],
    ]);
    // Within a date, input (syllabus) order is kept rather than time of day.
    expect(schedule.upcoming[2].reviews.map((r) => r.conceptName)).toEqual(["Load balancing", "Retries"]);
  });

  it("groups by the calendar date in the given time zone, not the UTC date", () => {
    // 02:00 UTC on Sep 26 is still the evening of Sep 25 in New York,
    // and 23:30 UTC on Sep 25 is already Sep 26 in Tokyo.
    const reviews = [review("Late evening", "2026-09-26T02:00:00Z"), review("Early morning", "2026-09-25T23:30:00Z")];

    const newYork = groupReviewSchedule(reviews, { now: NOW, timeZone: "America/New_York" });
    expect(newYork.upcoming.map((g) => [g.date, g.label, g.reviews.map((r) => r.conceptName)])).toEqual([
      ["2026-09-25", "Tomorrow", ["Late evening", "Early morning"]],
    ]);

    // At 15:00 UTC on Sep 24 it's already Sep 25 in Tokyo, so both fall on Sep 26: tomorrow there.
    const tokyo = groupReviewSchedule(reviews, { now: NOW, timeZone: "Asia/Tokyo" });
    expect(tokyo.upcoming.map((g) => [g.date, g.label, g.reviews.map((r) => r.conceptName)])).toEqual([
      ["2026-09-26", "Tomorrow", ["Late evening", "Early morning"]],
    ]);

    const utc = groupReviewSchedule(reviews, { now: NOW, timeZone: "UTC" });
    expect(utc.upcoming.map((g) => [g.date, g.label, g.reviews.map((r) => r.conceptName)])).toEqual([
      ["2026-09-25", "Tomorrow", ["Early morning"]],
      ["2026-09-26", "Sep 26", ["Late evening"]],
    ]);
  });

  it("gives the same result however often it runs on the same input", () => {
    const reviews = [
      review("B", "2026-09-27T10:00:00Z"),
      review("A", "2026-09-26T10:00:00Z"),
      review("C", "2026-09-27T09:00:00Z"),
    ];
    const first = groupReviewSchedule(reviews, { now: NOW, timeZone: "UTC" });
    const second = groupReviewSchedule([...reviews], { now: NOW, timeZone: "UTC" });

    expect(second).toEqual(first);
    expect(first.upcoming.map((g) => g.reviews.map((r) => r.conceptName))).toEqual([["A"], ["B", "C"]]);
  });

  describe("when the locale's formatted date layout differs", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("still groups and orders by calendar date", () => {
      // Some ICU/browser versions have formatted en-CA dates as "9/24/2026" rather than "2026-09-24".
      class OtherLayout extends Intl.DateTimeFormat {
        override format() {
          return "9/24/2026";
        }
      }
      vi.stubGlobal("Intl", { ...Intl, DateTimeFormat: OtherLayout });

      const schedule = groupReviewSchedule(
        [review("Later", "2026-10-02T10:00:00Z"), review("Sooner", "2026-09-25T10:00:00Z"), review("Due", "2026-09-20T10:00:00Z")],
        { now: NOW, timeZone: "UTC" },
      );

      expect(schedule.dueNow.map((r) => r.conceptName)).toEqual(["Due"]);
      expect(schedule.upcoming.map((g) => [g.date, g.reviews.map((r) => r.conceptName)])).toEqual([
        ["2026-09-25", ["Sooner"]],
        ["2026-10-02", ["Later"]],
      ]);
      expect(schedule.upcoming[0].label).toBe("Tomorrow");
    });
  });

  it("returns empty groups when nothing is scheduled", () => {
    expect(groupReviewSchedule([], { now: NOW, timeZone: "UTC" })).toEqual({ dueNow: [], upcoming: [] });
  });
});
