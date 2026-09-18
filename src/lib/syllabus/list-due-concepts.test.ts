import { describe, expect, it } from "vitest";
import { FakeSyllabusRepository } from "./fake-repository";
import { listDueConcepts } from "./list-due-concepts";
import type { SyllabusRepository } from "./repository";

describe("listDueConcepts", () => {
  it("lists only studied Concepts whose next-due date has arrived", async () => {
    const repo: SyllabusRepository = new FakeSyllabusRepository();
    const domain = await repo.createDomain({ name: "Software Engineering" });
    const subject = await repo.createSubject(domain.id, { name: "System Design" });

    const planned = await repo.createConcept(subject.id, { name: "Sharding" });

    const dueSoon = await repo.createConcept(subject.id, { name: "Idempotency" });
    await repo.setConceptStatus(dueSoon.id, "studied");

    const notYetDue = await repo.createConcept(subject.id, { name: "Backpressure" });
    await repo.setConceptStatus(notYetDue.id, "studied");
    await repo.updateConceptReviewSchedule(notYetDue.id, {
      intervalDays: 10,
      easeFactor: 2.5,
      nextDueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const due = await listDueConcepts(repo);

    expect(due.map((d) => d.concept.id)).toEqual([dueSoon.id]);
    expect(due.map((d) => d.concept.id)).not.toContain(planned.id);
    expect(due.map((d) => d.concept.id)).not.toContain(notYetDue.id);
  });

  it("reflects a schedule update as of the moment it happened", async () => {
    const repo: SyllabusRepository = new FakeSyllabusRepository();
    const domain = await repo.createDomain({ name: "Software Engineering" });
    const subject = await repo.createSubject(domain.id, { name: "System Design" });
    const concept = await repo.createConcept(subject.id, { name: "Idempotency" });
    await repo.setConceptStatus(concept.id, "studied");
    await repo.updateConceptReviewSchedule(concept.id, {
      intervalDays: 10,
      easeFactor: 2.5,
      nextDueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    });

    expect(await listDueConcepts(repo)).toHaveLength(0);

    await repo.updateConceptReviewSchedule(concept.id, {
      intervalDays: 1,
      easeFactor: 2.5,
      nextDueAt: new Date().toISOString(),
    });

    expect(await listDueConcepts(repo)).toHaveLength(1);
  });
});
