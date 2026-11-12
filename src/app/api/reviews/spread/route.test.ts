import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";

const fakes = vi.hoisted(() => ({
  syllabusRepo: undefined as unknown as FakeSyllabusRepository,
}));

vi.mock("@/lib/syllabus/get-repository", () => ({
  getSyllabusRepository: () => fakes.syllabusRepo,
}));

const { POST } = await import("./route");

function post(fields: Record<string, string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.set(name, value);
  return POST(
    new NextRequest("https://drills.example.com/api/reviews/spread", {
      method: "POST",
      body,
    }),
  );
}

describe("POST /api/reviews/spread", () => {
  let repo: FakeSyllabusRepository;

  beforeEach(() => {
    repo = new FakeSyllabusRepository();
    fakes.syllabusRepo = repo;
  });

  async function seedOverdue(count: number) {
    const domain = await repo.createDomain({ name: "Software Engineering" });
    const subject = await repo.createSubject(domain.id, {
      name: "System Design",
    });
    for (let i = 0; i < count; i++) {
      const concept = await repo.createConcept(subject.id, {
        name: `Concept ${i}`,
      });
      await repo.setConceptStatus(concept.id, "studied");
      await repo.updateConceptReviewSchedule(concept.id, {
        intervalDays: 3,
        easeFactor: 2.5,
        nextDueAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
  }

  it("spreads the backlog and redirects to the schedule with what moved", async () => {
    await seedOverdue(5);

    const response = await post({
      perDay: "2",
      timeZone: "UTC",
      view: "calendar",
    });

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/study/schedule");
    expect(Object.fromEntries(location.searchParams)).toEqual({
      spread: "5",
      days: "3",
      view: "calendar",
    });
    const dueNow = (await repo.listStudiedConcepts()).filter(
      ({ concept }) => new Date(concept.nextReviewDueAt!).getTime() <= Date.now(),
    );
    expect(dueNow).toHaveLength(2);
  });

  it.each([
    ["a missing perDay", { timeZone: "UTC" }],
    ["a perDay of 0", { perDay: "0", timeZone: "UTC" }],
    ["a fractional perDay", { perDay: "2.5", timeZone: "UTC" }],
    ["a perDay over the limit", { perDay: "101", timeZone: "UTC" }],
    ["a missing time zone", { perDay: "5" }],
    ["an unknown time zone", { perDay: "5", timeZone: "Mars/Olympus_Mons" }],
  ])("rejects %s with 400, moving nothing", async (_case, fields) => {
    await seedOverdue(1);
    const before = await repo.listStudiedConcepts();

    const response = await post(fields);

    expect(response.status).toBe(400);
    expect(await repo.listStudiedConcepts()).toEqual(before);
  });
});
