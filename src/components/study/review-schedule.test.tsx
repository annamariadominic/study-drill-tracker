import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { groupReviewSchedule, type ScheduledReview } from "@/lib/syllabus/review-schedule";
import { ReviewSchedule } from "./review-schedule";
import { ReviewScheduleList } from "./review-schedule-list";

const NOW = new Date("2026-09-24T15:00:00Z");

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

function renderList(reviews: ScheduledReview[], hasStudiedConcepts = true) {
  const schedule = groupReviewSchedule(reviews, { now: NOW, timeZone: "UTC" });
  return renderToStaticMarkup(<ReviewScheduleList schedule={schedule} hasStudiedConcepts={hasStudiedConcepts} />);
}

/** Text content in document order, so the test can check what comes before what. */
function text(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("ReviewScheduleList", () => {
  it("shows due-now reviews apart from later dates, with Concept, Subject, Domain and date", () => {
    const html = renderList([
      review("Idempotency", "2026-09-29T10:00:00Z", { subjectName: "API Design" }),
      review("Deterministic vs probabilistic components", "2026-09-22T10:00:00Z", {
        subjectName: "Foundations",
        domainName: "AI Engineering",
      }),
      review("Prompt chaining", "2026-09-25T10:00:00Z", { subjectName: "Foundations", domainName: "AI Engineering" }),
      review("Load balancing", "2026-09-27T10:00:00Z"),
    ]);
    const content = text(html);

    expect(content).toContain("Deterministic vs probabilistic components AI Engineering › Foundations · Due Sep 22");
    expect(content).toContain("Prompt chaining AI Engineering › Foundations");
    expect(content).toContain("Load balancing Software Engineering › System Design");
    expect(content).toContain("Idempotency Software Engineering › API Design");

    const order = ["Due now", "Deterministic", "Tomorrow", "Sep 25", "Prompt chaining", "Sep 27", "Load balancing", "Sep 29", "Idempotency"];
    const positions = order.map((part) => content.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    expect(html).toContain('href="/study/due"');
  });

  it("says nothing is due when only future reviews exist", () => {
    const html = renderList([review("Load balancing", "2026-09-27T10:00:00Z")]);

    expect(text(html)).toContain("Due now , 0 Concepts Nothing due right now.");
    expect(html).not.toContain('href="/study/due"');
    expect(text(html)).toContain("Load balancing");
  });

  it("says nothing else is scheduled when everything is due now", () => {
    const html = renderList([review("Load balancing", "2026-09-24T09:00:00Z")]);

    expect(text(html)).toContain("Load balancing Software Engineering › System Design · Due today");
    expect(text(html)).toContain("Nothing else scheduled yet.");
  });

  it("explains an empty schedule when nothing is studied yet", () => {
    const html = renderList([], false);

    expect(text(html)).toContain("Nothing scheduled yet");
    expect(html).not.toContain("Due now");
  });

  it("explains an empty schedule when studied Concepts have no review date", () => {
    const html = renderList([], true);

    expect(text(html)).toContain("No reviews scheduled");
    expect(html).not.toContain("Due now");
  });
});

describe("ReviewSchedule", () => {
  it("renders on the server with UTC calendar dates", () => {
    const html = renderToStaticMarkup(
      <ReviewSchedule
        reviews={[review("Load balancing", "2026-09-26T02:00:00Z")]}
        now={NOW.toISOString()}
        hasStudiedConcepts
      />,
    );

    expect(text(html)).toContain("Sep 26");
    expect(text(html)).toContain("Load balancing");
  });
});
