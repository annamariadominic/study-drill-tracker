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

describe("ReviewSchedule calendar view", () => {
  function renderCalendar(reviews: ScheduledReview[]) {
    return renderToStaticMarkup(
      <ReviewSchedule reviews={reviews} now={NOW.toISOString()} hasStudiedConcepts view="calendar" />,
    );
  }

  it("shows the current month with reviews on their days and the first upcoming day listed", () => {
    const html = renderCalendar([
      review("Prompt chaining", "2026-09-25T10:00:00Z", { subjectName: "Foundations", domainName: "AI Engineering" }),
      review("Load balancing", "2026-09-27T10:00:00Z"),
      review("Caching", "2026-09-27T11:00:00Z"),
      review("Retries", "2026-09-27T12:00:00Z"),
    ]);
    const content = text(html);

    expect(content).toContain("September 2026");
    expect(html).toContain('aria-label="Friday, September 25: 1 review"');
    expect(html).toContain('aria-label="Sunday, September 27: 3 reviews"');
    expect(content).toContain("+1 more");
    // The first day with reviews is selected, and its reviews are listed with Subject and Domain.
    expect(html).toMatch(/aria-pressed="true" aria-label="Friday, September 25/);
    expect(content).toContain("Friday, September 25 1 Concept Prompt chaining AI Engineering › Foundations");
    // Nothing is shown before the current month, so there's no going back from it.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Previous month"/);
  });

  it("surfaces overdue reviews above the calendar instead of on past days", () => {
    const html = renderCalendar([
      review("Overdue", "2026-09-20T10:00:00Z"),
      review("Earlier today", "2026-09-24T08:00:00Z"),
    ]);
    const content = text(html);

    expect(content).toContain("1 Concept overdue from before today.");
    expect(html).toContain('href="/study/due"');
    expect(html).toContain('aria-label="Today, Thursday, September 24: 1 review"');
    expect(html).not.toContain('aria-label="Sunday, September 20');
  });

  it("says when the month has nothing scheduled", () => {
    const content = text(renderCalendar([review("Next month", "2026-10-02T10:00:00Z")]));

    expect(content).toContain("No reviews scheduled in September 2026.");
  });

  it("shows the list's empty state when nothing is scheduled", () => {
    const html = renderToStaticMarkup(
      <ReviewSchedule reviews={[]} now={NOW.toISOString()} hasStudiedConcepts={false} view="calendar" />,
    );

    expect(text(html)).toContain("Nothing scheduled yet");
    expect(html).not.toContain("<table");
  });
});
