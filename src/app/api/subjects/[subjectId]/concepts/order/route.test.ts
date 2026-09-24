import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";

const fakes = vi.hoisted(() => ({
  syllabusRepo: undefined as unknown as FakeSyllabusRepository,
}));

vi.mock("@/lib/syllabus/get-repository", () => ({
  getSyllabusRepository: () => fakes.syllabusRepo,
}));

const { PUT } = await import("./route");

function put(subjectId: string, body: unknown) {
  const request = new NextRequest(`https://drills.example.com/api/subjects/${subjectId}/concepts/order`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ subjectId }) });
}

describe("PUT /api/subjects/[subjectId]/concepts/order", () => {
  let repo: FakeSyllabusRepository;

  beforeEach(() => {
    repo = new FakeSyllabusRepository();
    fakes.syllabusRepo = repo;
  });

  async function seed() {
    const domain = await repo.createDomain({ name: "Software Engineering" });
    const subject = await repo.createSubject(domain.id, { name: "System Design" });
    const queues = await repo.createConcept(subject.id, { name: "Queues" });
    const retries = await repo.createConcept(subject.id, { name: "Retries" });
    const idempotency = await repo.createConcept(subject.id, { name: "Idempotency" });
    return { subject, queues, retries, idempotency };
  }

  async function names(subjectId: string) {
    return (await repo.listConcepts(subjectId)).map((concept) => concept.name);
  }

  it("saves the new order", async () => {
    const { subject, queues, retries, idempotency } = await seed();

    const response = await put(subject.id, { conceptIds: [idempotency.id, queues.id, retries.id] });

    expect(response.status).toBe(204);
    expect(await names(subject.id)).toEqual(["Idempotency", "Queues", "Retries"]);
  });

  it("rejects a filtered (partial) list with 409, leaving hidden Concepts where they were", async () => {
    const { subject, queues, retries, idempotency } = await seed();
    await repo.setConceptStatus(retries.id, "studied");

    // Only the planned Concepts, as a Planned-filtered view would list them.
    const response = await put(subject.id, { conceptIds: [idempotency.id, queues.id] });

    expect(response.status).toBe(409);
    expect(await names(subject.id)).toEqual(["Queues", "Retries", "Idempotency"]);
  });

  it.each([
    ["not JSON", "not json"],
    ["missing conceptIds", {}],
    ["conceptIds not an array", { conceptIds: "abc" }],
    ["conceptIds with a non-string", { conceptIds: [1, 2, 3] }],
  ])("rejects a body that is %s with 400", async (_case, body) => {
    const { subject } = await seed();

    const response = await put(subject.id, body);

    expect(response.status).toBe(400);
  });

  it("returns 404 for a missing Subject", async () => {
    const response = await put("missing", { conceptIds: [] });

    expect(response.status).toBe(404);
  });
});
