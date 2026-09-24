import { beforeEach, describe, expect, it } from "vitest";
import { FakeSyllabusRepository } from "./fake-repository";
import { InvalidOrderError, NotFoundError } from "./errors";

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

    describe("ordering", () => {
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

      it("persists a reorder and lists Subjects in the new order", async () => {
        const { domain, architecture, workflows, agents } = await seed();

        await repo.reorderSubjects(domain.id, [agents.id, architecture.id, workflows.id]);

        expect(await names(domain.id)).toEqual([
          "Agent fundamentals",
          "Choosing the right AI architecture",
          "LLM workflow patterns",
        ]);
      });

      it("adds a new Subject to the bottom, and it can then be moved to the top", async () => {
        const { domain, architecture, workflows, agents } = await seed();

        const fundamentals = await repo.createSubject(domain.id, { name: "AI system fundamentals" });
        expect(await names(domain.id)).toEqual([
          "Choosing the right AI architecture",
          "LLM workflow patterns",
          "Agent fundamentals",
          "AI system fundamentals",
        ]);

        await repo.reorderSubjects(domain.id, [fundamentals.id, architecture.id, workflows.id, agents.id]);
        expect(await names(domain.id)).toEqual([
          "AI system fundamentals",
          "Choosing the right AI architecture",
          "LLM workflow patterns",
          "Agent fundamentals",
        ]);
      });

      it("adds a new Subject to the bottom of a reordered list", async () => {
        const { domain, architecture, workflows, agents } = await seed();
        await repo.reorderSubjects(domain.id, [agents.id, workflows.id, architecture.id]);

        await repo.createSubject(domain.id, { name: "AI system fundamentals" });

        expect(await names(domain.id)).toEqual([
          "Agent fundamentals",
          "LLM workflow patterns",
          "Choosing the right AI architecture",
          "AI system fundamentals",
        ]);
      });

      it.each([
        ["a Subject is missing", (ids: string[]) => ids.slice(1)],
        ["a Subject is repeated", (ids: string[]) => [ids[0], ...ids]],
        ["a Subject is repeated in place of another", (ids: string[]) => [ids[0], ids[0], ids[2]]],
        ["an unknown id is included", (ids: string[]) => [...ids, "missing"]],
      ])("rejects the order and changes nothing when %s", async (_case, mangle) => {
        const { domain, architecture, workflows, agents } = await seed();
        const before = await names(domain.id);

        await expect(
          repo.reorderSubjects(domain.id, mangle([agents.id, architecture.id, workflows.id])),
        ).rejects.toThrow(InvalidOrderError);

        expect(await names(domain.id)).toEqual(before);
      });

      it("rejects a Subject from another Domain and changes neither Domain", async () => {
        const { domain, architecture, workflows, agents } = await seed();
        const other = await repo.createDomain({ name: "Software Engineering" });
        const systemDesign = await repo.createSubject(other.id, { name: "System Design" });

        await expect(
          repo.reorderSubjects(domain.id, [systemDesign.id, architecture.id, workflows.id]),
        ).rejects.toThrow(InvalidOrderError);
        await expect(
          repo.reorderSubjects(domain.id, [agents.id, architecture.id, workflows.id, systemDesign.id]),
        ).rejects.toThrow(InvalidOrderError);

        expect(await names(domain.id)).toEqual([
          "Choosing the right AI architecture",
          "LLM workflow patterns",
          "Agent fundamentals",
        ]);
        expect((await repo.listSubjects(other.id)).map((subject) => subject.position)).toEqual([0]);
      });

      it("throws NotFoundError when reordering a missing Domain", async () => {
        await expect(repo.reorderSubjects("missing", [])).rejects.toThrow(NotFoundError);
      });
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
