import { describe, expect, it } from "vitest";
import { FakeSyllabusRepository } from "./fake-repository";
import { calendarDate } from "./review-schedule";
import { countDueBeforeToday, spreadBacklog } from "./spread-backlog";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-12T15:00:00Z");
const TIME_ZONE = "America/Los_Angeles";

async function seed() {
  const repo = new FakeSyllabusRepository();
  const domain = await repo.createDomain({ name: "Software Engineering" });
  const subject = await repo.createSubject(domain.id, {
    name: "System Design",
  });

  async function studied(name: string, schedule: { intervalDays: number; easeFactor?: number; dueInDays: number }) {
    const concept = await repo.createConcept(subject.id, { name });
    await repo.setConceptStatus(concept.id, "studied");
    await repo.updateConceptReviewSchedule(concept.id, {
      intervalDays: schedule.intervalDays,
      easeFactor: schedule.easeFactor ?? 2.5,
      nextDueAt: new Date(NOW.getTime() + schedule.dueInDays * DAY).toISOString(),
    });
    return concept;
  }

  async function dueDates() {
    const concepts = await repo.listStudiedConcepts();
    return Object.fromEntries(
      concepts.map(({ concept }) => [concept.name, calendarDate(new Date(concept.nextReviewDueAt!), TIME_ZONE)]),
    );
  }

  return { repo, studied, dueDates };
}

describe("spreadBacklog", () => {
  it("re-dates overdue Concepts so no day from today on holds more than the daily limit", async () => {
    const { repo, studied, dueDates } = await seed();
    for (let i = 0; i < 5; i++) {
      await studied(`Overdue ${i}`, { intervalDays: 4, dueInDays: -20 + i });
    }

    const spread = await spreadBacklog(repo, { perDay: 2, timeZone: TIME_ZONE }, NOW);

    expect(spread.moves).toHaveLength(5);
    expect(spread.days).toBe(3);
    expect(await dueDates()).toEqual({
      "Overdue 0": "2026-11-12",
      "Overdue 1": "2026-11-12",
      "Overdue 2": "2026-11-13",
      "Overdue 3": "2026-11-13",
      "Overdue 4": "2026-11-14",
    });
  });

  it("brings the weakest Concepts back first, then the longest overdue", async () => {
    const { repo, studied, dueDates } = await seed();
    await studied("Well known", { intervalDays: 30, dueInDays: -40 });
    await studied("Shaky, recently due", { intervalDays: 1, dueInDays: -2 });
    await studied("Shaky, long overdue", { intervalDays: 1, dueInDays: -21 });

    await spreadBacklog(repo, { perDay: 1, timeZone: TIME_ZONE }, NOW);

    expect(await dueDates()).toEqual({
      "Well known": "2026-11-14",
      "Shaky, recently due": "2026-11-13",
      "Shaky, long overdue": "2026-11-12",
    });
  });

  it("counts reviews already on the calendar against each day's limit, and leaves them where they are", async () => {
    const { repo, studied, dueDates } = await seed();
    await studied("Booked tomorrow", { intervalDays: 6, dueInDays: 1 });
    await studied("Booked tonight", { intervalDays: 6, dueInDays: 0.25 });
    await studied("Overdue A", { intervalDays: 2, dueInDays: -9 });
    await studied("Overdue B", { intervalDays: 2, dueInDays: -8 });

    await spreadBacklog(repo, { perDay: 1, timeZone: TIME_ZONE }, NOW);

    expect(await dueDates()).toEqual({
      "Booked tomorrow": "2026-11-13",
      "Booked tonight": "2026-11-12",
      "Overdue A": "2026-11-14",
      "Overdue B": "2026-11-15",
    });
  });

  it("keeps each Concept's interval and ease", async () => {
    const { repo, studied } = await seed();
    const concept = await studied("Idempotency", {
      intervalDays: 12,
      easeFactor: 2.1,
      dueInDays: -30,
    });

    await spreadBacklog(repo, { perDay: 5, timeZone: TIME_ZONE }, NOW);

    const after = await repo.getConcept(concept.id);
    expect(after?.reviewIntervalDays).toBe(12);
    expect(after?.reviewEaseFactor).toBe(2.1);
    expect(after?.nextReviewDueAt).toBe(NOW.toISOString());
  });

  it("does nothing when nothing is due", async () => {
    const { repo, studied, dueDates } = await seed();
    await studied("Later", { intervalDays: 3, dueInDays: 3 });

    const spread = await spreadBacklog(repo, { perDay: 5, timeZone: TIME_ZONE }, NOW);

    expect(spread).toEqual({ moves: [], days: 0 });
    expect(await dueDates()).toEqual({ Later: "2026-11-15" });
  });
});

describe("countDueBeforeToday", () => {
  it("counts only reviews that fell due on an earlier day in the learner's time zone", () => {
    // 07:00 on Nov 12 in Los Angeles.
    const dueAts = [
      "2026-11-12T08:00:00Z", // 00:00 Nov 12 in LA: today
      "2026-11-12T07:59:00Z", // 23:59 Nov 11 in LA: yesterday
      "2026-10-01T12:00:00Z",
      NOW.toISOString(),
    ];

    expect(countDueBeforeToday(dueAts, { now: NOW, timeZone: TIME_ZONE })).toBe(2);
  });

  it("finds no backlog right after a spread has put reviews on today", async () => {
    const { repo, studied } = await seed();
    await studied("Overdue", { intervalDays: 1, dueInDays: -10 });
    await spreadBacklog(repo, { perDay: 5, timeZone: TIME_ZONE }, NOW);

    const dueAts = (await repo.listStudiedConcepts()).map(({ concept }) => concept.nextReviewDueAt!);

    expect(countDueBeforeToday(dueAts, { now: NOW, timeZone: TIME_ZONE })).toBe(0);
  });
});
