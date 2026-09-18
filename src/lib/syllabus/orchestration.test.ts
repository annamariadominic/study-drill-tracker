import { describe, expect, it } from "vitest";
import { FakeSyllabusRepository } from "./fake-repository";
import type { SyllabusRepository } from "./repository";

async function buildSyllabus(repo: SyllabusRepository) {
  const domain = await repo.createDomain({ name: "Software Engineering" });
  const subject = await repo.createSubject(domain.id, { name: "System Design" });
  const concept = await repo.createConcept(subject.id, { name: "Idempotency" });
  return { domain, subject, concept };
}

describe("syllabus orchestration (against the fake repository)", () => {
  it("builds a Domain -> Subject -> Concept syllabus and edits it end-to-end", async () => {
    const repo: SyllabusRepository = new FakeSyllabusRepository();
    const { domain, subject, concept } = await buildSyllabus(repo);

    // A freshly created Concept is planned, with no notes, and doesn't
    // show up anywhere reserved for studied concepts.
    expect(concept.status).toBe("planned");
    expect(concept.notes).toBeNull();

    // Domain, Subject, and Concept can all be renamed after creation.
    const renamedDomain = await repo.updateDomain(domain.id, { name: "SWE" });
    const renamedSubject = await repo.updateSubject(subject.id, {
      name: "Distributed Systems",
    });
    const renamedConcept = await repo.updateConcept(concept.id, {
      name: "Idempotent retries",
    });
    expect(renamedDomain.name).toBe("SWE");
    expect(renamedSubject.name).toBe("Distributed Systems");
    expect(renamedConcept.name).toBe("Idempotent retries");

    // Marking studied and then enriching notes afterward doesn't revert status.
    const studied = await repo.setConceptStatus(concept.id, "studied");
    expect(studied.status).toBe("studied");

    const enriched = await repo.updateConcept(concept.id, {
      notes: "Retrying a request has no additional effect beyond the first.",
    });
    expect(enriched.status).toBe("studied");
    expect(enriched.notes).toBe(
      "Retrying a request has no additional effect beyond the first.",
    );

    const concepts = await repo.listConcepts(subject.id);
    expect(concepts).toHaveLength(1);
    expect(concepts[0]).toEqual(enriched);
  });

  it("pulls a studied Concept's next review closer when its notes are enriched", async () => {
    const repo: SyllabusRepository = new FakeSyllabusRepository();
    const { concept } = await buildSyllabus(repo);

    const studied = await repo.setConceptStatus(concept.id, "studied");
    expect(studied.reviewIntervalDays).toBe(1);
    expect(studied.nextReviewDueAt).not.toBeNull();

    // Grow the interval first via a review-schedule update, so halving it is observable.
    const grown = await repo.updateConceptReviewSchedule(concept.id, {
      intervalDays: 10,
      easeFactor: 2.6,
      nextDueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(grown.reviewIntervalDays).toBe(10);

    const enriched = await repo.updateConcept(concept.id, {
      notes: "Retrying a request has no additional effect beyond the first.",
    });

    // Halved, not reset — and the ease factor is untouched.
    expect(enriched.reviewIntervalDays).toBe(5);
    expect(enriched.reviewEaseFactor).toBe(2.6);
    expect(new Date(enriched.nextReviewDueAt ?? 0).getTime()).toBeLessThan(
      new Date(grown.nextReviewDueAt ?? 0).getTime(),
    );

    // Editing notes again with the same value is a no-op on the schedule.
    const unchanged = await repo.updateConcept(concept.id, {
      notes: "Retrying a request has no additional effect beyond the first.",
    });
    expect(unchanged.reviewIntervalDays).toBe(5);

    // A planned (never-studied) Concept has no schedule to pull closer.
    const plannedConcept = await repo.createConcept(
      (await repo.getConcept(concept.id))!.subjectId,
      { name: "Backpressure" },
    );
    const plannedWithNotes = await repo.updateConcept(plannedConcept.id, {
      notes: "Slow the producer down.",
    });
    expect(plannedWithNotes.reviewIntervalDays).toBeNull();
  });
});
