import { beforeEach, describe, expect, it } from "vitest";
import { filterConcepts, parseConceptFilter } from "./concept-filter";
import { FakeSyllabusRepository } from "./fake-repository";

describe("Concept filter", () => {
  let repo: FakeSyllabusRepository;

  beforeEach(() => {
    repo = new FakeSyllabusRepository();
  });

  async function seedReordered() {
    const domain = await repo.createDomain({ name: "Software Engineering" });
    const subject = await repo.createSubject(domain.id, { name: "System Design" });
    const queues = await repo.createConcept(subject.id, { name: "Queues" });
    const retries = await repo.createConcept(subject.id, { name: "Retries" });
    const idempotency = await repo.createConcept(subject.id, { name: "Idempotency" });
    const caching = await repo.createConcept(subject.id, { name: "Caching" });
    await repo.setConceptStatus(retries.id, "studied");
    await repo.setConceptStatus(caching.id, "studied");
    await repo.reorderConcepts(subject.id, [caching.id, idempotency.id, queues.id, retries.id]);
    return repo.listConcepts(subject.id);
  }

  const names = (concepts: { name: string }[]) => concepts.map((concept) => concept.name);

  it("shows every Concept in the saved order under All", async () => {
    const concepts = await seedReordered();

    expect(names(filterConcepts(concepts, undefined))).toEqual(["Caching", "Idempotency", "Queues", "Retries"]);
  });

  it("shows only studied Concepts, still in the saved order", async () => {
    const concepts = await seedReordered();

    expect(names(filterConcepts(concepts, "studied"))).toEqual(["Caching", "Retries"]);
  });

  it("shows only planned Concepts, still in the saved order", async () => {
    const concepts = await seedReordered();

    expect(names(filterConcepts(concepts, "planned"))).toEqual(["Idempotency", "Queues"]);
  });

  it.each([
    ["studied", "studied"],
    ["planned", "planned"],
    [undefined, undefined],
    ["everything", undefined],
    ["", undefined],
  ])("reads the show=%s parameter as %s", (param, expected) => {
    expect(parseConceptFilter(param)).toBe(expected);
  });
});
