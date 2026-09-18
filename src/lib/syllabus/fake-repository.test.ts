import { beforeEach, describe, expect, it } from "vitest";
import { FakeSyllabusRepository } from "./fake-repository";
import { NotFoundError } from "./errors";

describe("FakeSyllabusRepository", () => {
  let repo: FakeSyllabusRepository;

  beforeEach(() => {
    repo = new FakeSyllabusRepository();
  });

  describe("domains", () => {
    it("creates and lists domains", async () => {
      await repo.createDomain({ name: "Software Engineering" });
      const domains = await repo.listDomains();
      expect(domains).toHaveLength(1);
      expect(domains[0].name).toBe("Software Engineering");
      expect(domains[0].id).toBeTruthy();
    });

    it("gets a domain by id", async () => {
      const created = await repo.createDomain({ name: "Software Engineering" });
      const found = await repo.getDomain(created.id);
      expect(found).toEqual(created);
    });

    it("returns null for a missing domain", async () => {
      expect(await repo.getDomain("missing")).toBeNull();
    });

    it("renames a domain", async () => {
      const created = await repo.createDomain({ name: "Software Engineering" });
      const updated = await repo.updateDomain(created.id, { name: "SWE" });
      expect(updated.name).toBe("SWE");
      expect((await repo.getDomain(created.id))?.name).toBe("SWE");
    });

    it("throws NotFoundError when renaming a missing domain", async () => {
      await expect(repo.updateDomain("missing", { name: "x" })).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("subjects", () => {
    it("creates subjects scoped to a domain and lists only that domain's subjects", async () => {
      const domainA = await repo.createDomain({ name: "Software Engineering" });
      const domainB = await repo.createDomain({ name: "ML" });
      await repo.createSubject(domainA.id, { name: "System Design" });
      await repo.createSubject(domainB.id, { name: "ML System Design" });

      const subjectsA = await repo.listSubjects(domainA.id);
      expect(subjectsA).toHaveLength(1);
      expect(subjectsA[0].name).toBe("System Design");
      expect(subjectsA[0].domainId).toBe(domainA.id);
    });

    it("renames a subject", async () => {
      const domain = await repo.createDomain({ name: "Software Engineering" });
      const subject = await repo.createSubject(domain.id, { name: "System Design" });
      const updated = await repo.updateSubject(subject.id, { name: "Distributed Systems" });
      expect(updated.name).toBe("Distributed Systems");
    });

    it("throws NotFoundError when renaming a missing subject", async () => {
      await expect(repo.updateSubject("missing", { name: "x" })).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("concepts", () => {
    it("creates a concept with just a name, defaulting to planned status", async () => {
      const domain = await repo.createDomain({ name: "Software Engineering" });
      const subject = await repo.createSubject(domain.id, { name: "System Design" });
      const concept = await repo.createConcept(subject.id, { name: "Idempotency" });

      expect(concept.name).toBe("Idempotency");
      expect(concept.notes).toBeNull();
      expect(concept.status).toBe("planned");
      expect(concept.studiedAt).toBeNull();
    });

    it("lists concepts scoped to a subject", async () => {
      const domain = await repo.createDomain({ name: "Software Engineering" });
      const subjectA = await repo.createSubject(domain.id, { name: "System Design" });
      const subjectB = await repo.createSubject(domain.id, { name: "API Design" });
      await repo.createConcept(subjectA.id, { name: "Idempotency" });
      await repo.createConcept(subjectB.id, { name: "Pagination" });

      const conceptsA = await repo.listConcepts(subjectA.id);
      expect(conceptsA).toHaveLength(1);
      expect(conceptsA[0].name).toBe("Idempotency");
    });

    it("marks a concept studied and stamps studiedAt", async () => {
      const domain = await repo.createDomain({ name: "Software Engineering" });
      const subject = await repo.createSubject(domain.id, { name: "System Design" });
      const concept = await repo.createConcept(subject.id, { name: "Idempotency" });

      const studied = await repo.setConceptStatus(concept.id, "studied");
      expect(studied.status).toBe("studied");
      expect(studied.studiedAt).toBeTruthy();
    });

    it("clears studiedAt when a concept moves back to planned", async () => {
      const domain = await repo.createDomain({ name: "Software Engineering" });
      const subject = await repo.createSubject(domain.id, { name: "System Design" });
      const concept = await repo.createConcept(subject.id, { name: "Idempotency" });

      await repo.setConceptStatus(concept.id, "studied");
      const backToPlanned = await repo.setConceptStatus(concept.id, "planned");
      expect(backToPlanned.status).toBe("planned");
      expect(backToPlanned.studiedAt).toBeNull();
    });

    it("edits notes on a studied concept without changing its status", async () => {
      const domain = await repo.createDomain({ name: "Software Engineering" });
      const subject = await repo.createSubject(domain.id, { name: "System Design" });
      const concept = await repo.createConcept(subject.id, { name: "Idempotency" });
      await repo.setConceptStatus(concept.id, "studied");

      const updated = await repo.updateConcept(concept.id, {
        notes: "Safe to retry without side effects.",
      });

      expect(updated.notes).toBe("Safe to retry without side effects.");
      expect(updated.status).toBe("studied");
    });

    it("throws NotFoundError when updating a missing concept", async () => {
      await expect(repo.updateConcept("missing", { name: "x" })).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
