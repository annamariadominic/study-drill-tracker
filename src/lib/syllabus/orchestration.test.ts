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
});
