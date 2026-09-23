import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { FakeEmailPort } from "@/lib/reminders/fake-email-port";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";

const fakes = vi.hoisted(() => ({
  syllabusRepo: undefined as unknown as FakeSyllabusRepository,
  emailPort: undefined as unknown as FakeEmailPort,
}));

vi.mock("@/lib/syllabus/get-repository", () => ({
  getSyllabusRepository: () => fakes.syllabusRepo,
}));
vi.mock("@/lib/reminders/get-email-port", () => ({
  getEmailPort: () => fakes.emailPort,
}));

const { GET } = await import("./route");

const CRON_SECRET = "test-cron-secret";
const SESSION_SECRET = "test-session-secret-at-least-32-bytes-long";
const URL = "https://drills.example.com/api/cron/due-reminder";

async function addConcept(repo: FakeSyllabusRepository, input: { due: boolean }) {
  const domain = await repo.createDomain({ name: "Software Engineering" });
  const subject = await repo.createSubject(domain.id, { name: "System Design" });
  const concept = await repo.createConcept(subject.id, { name: "Idempotency" });
  await repo.setConceptStatus(concept.id, "studied");
  if (!input.due) {
    await repo.updateConceptReviewSchedule(concept.id, {
      intervalDays: 10,
      easeFactor: 2.5,
      nextDueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
}

describe("GET /api/cron/due-reminder", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
    fakes.syllabusRepo = new FakeSyllabusRepository();
    fakes.emailPort = new FakeEmailPort();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a request without CRON_SECRET and sends nothing", async () => {
    await addConcept(fakes.syllabusRepo, { due: true });

    const response = await GET(new NextRequest(URL));

    expect(response.status).toBe(401);
    expect(fakes.emailPort.sent).toHaveLength(0);
  });

  it("rejects a request with the wrong secret", async () => {
    await addConcept(fakes.syllabusRepo, { due: true });

    const response = await GET(
      new NextRequest(URL, { headers: { authorization: "Bearer wrong" } }),
    );

    expect(response.status).toBe(401);
    expect(fakes.emailPort.sent).toHaveLength(0);
  });

  it("rejects a valid user session cookie", async () => {
    await addConcept(fakes.syllabusRepo, { due: true });
    const token = await createSessionToken(SESSION_SECRET);

    const response = await GET(
      new NextRequest(URL, { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } }),
    );

    expect(response.status).toBe(401);
    expect(fakes.emailPort.sent).toHaveLength(0);
  });

  it("sends one email linking to the due-list when Concepts are due", async () => {
    await addConcept(fakes.syllabusRepo, { due: true });
    await addConcept(fakes.syllabusRepo, { due: true });

    const response = await GET(
      new NextRequest(URL, { headers: { authorization: `Bearer ${CRON_SECRET}` } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dueCount: 2, sent: true });
    expect(fakes.emailPort.sent).toHaveLength(1);
    expect(fakes.emailPort.sent[0].text).toContain("https://drills.example.com/study/due");
  });

  it("sends nothing when nothing is due", async () => {
    await addConcept(fakes.syllabusRepo, { due: false });

    const response = await GET(
      new NextRequest(URL, { headers: { authorization: `Bearer ${CRON_SECRET}` } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ dueCount: 0, sent: false });
    expect(fakes.emailPort.sent).toHaveLength(0);
  });
});
