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

function put(domainId: string, body: unknown) {
  const request = new NextRequest(`https://drills.example.com/api/domains/${domainId}/subjects/order`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ domainId }) });
}

describe("PUT /api/domains/[domainId]/subjects/order", () => {
  let repo: FakeSyllabusRepository;

  beforeEach(() => {
    repo = new FakeSyllabusRepository();
    fakes.syllabusRepo = repo;
  });

  async function seed() {
    const domain = await repo.createDomain({ name: "AI Engineering" });
    const architecture = await repo.createSubject(domain.id, { name: "Choosing the right AI architecture" });
    const workflows = await repo.createSubject(domain.id, { name: "LLM workflow patterns" });
    const agents = await repo.createSubject(domain.id, { name: "Agent fundamentals" });
    return { domain, architecture, workflows, agents };
  }

  async function names(domainId: string) {
    return (await repo.listSubjects(domainId)).map((subject) => subject.name);
  }

  it("saves the new order", async () => {
    const { domain, architecture, workflows, agents } = await seed();

    const response = await put(domain.id, { subjectIds: [agents.id, architecture.id, workflows.id] });

    expect(response.status).toBe(204);
    expect(await names(domain.id)).toEqual([
      "Agent fundamentals",
      "Choosing the right AI architecture",
      "LLM workflow patterns",
    ]);
  });

  it("rejects an order that isn't exactly the Domain's Subjects with 409, changing nothing", async () => {
    const { domain, architecture, agents } = await seed();

    const response = await put(domain.id, { subjectIds: [agents.id, architecture.id] });

    expect(response.status).toBe(409);
    expect(await names(domain.id)).toEqual([
      "Choosing the right AI architecture",
      "LLM workflow patterns",
      "Agent fundamentals",
    ]);
  });

  it.each([
    ["not JSON", "not json"],
    ["missing subjectIds", {}],
    ["subjectIds not an array", { subjectIds: "abc" }],
    ["subjectIds with a non-string", { subjectIds: [1, 2, 3] }],
  ])("rejects a body that is %s with 400", async (_case, body) => {
    const { domain } = await seed();

    const response = await put(domain.id, body);

    expect(response.status).toBe(400);
  });

  it("returns 404 for a missing Domain", async () => {
    const response = await put("missing", { subjectIds: [] });

    expect(response.status).toBe(404);
  });
});
