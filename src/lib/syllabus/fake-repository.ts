import { randomUUID } from "node:crypto";
import { initialReviewSchedule, pullReviewCloser, scheduleFromFields } from "@/lib/study/scheduling";
import { InvalidOrderError, NotFoundError } from "./errors";
import type { SyllabusRepository } from "./repository";
import type { Concept, ConceptStatus, Domain, Subject } from "./types";

/** Mirrors the exact-sibling check the database's reorder functions make. */
function assertSameSiblings(label: string, siblings: { id: string }[], requestedIds: string[]) {
  const siblingIds = new Set(siblings.map((sibling) => sibling.id));
  const exact =
    requestedIds.length === siblingIds.size &&
    new Set(requestedIds).size === requestedIds.length &&
    requestedIds.every((id) => siblingIds.has(id));
  if (!exact) {
    throw new InvalidOrderError(`The new order must list each of the ${label} exactly once`);
  }
}

export class FakeSyllabusRepository implements SyllabusRepository {
  private domains = new Map<string, Domain>();
  private subjects = new Map<string, Subject>();
  private concepts = new Map<string, Concept>();

  async listDomains(): Promise<Domain[]> {
    return [...this.domains.values()];
  }

  async getDomain(id: string): Promise<Domain | null> {
    return this.domains.get(id) ?? null;
  }

  async createDomain(input: { name: string }): Promise<Domain> {
    const domain: Domain = {
      id: randomUUID(),
      name: input.name,
      createdAt: new Date().toISOString(),
    };
    this.domains.set(domain.id, domain);
    return domain;
  }

  async updateDomain(id: string, input: { name: string }): Promise<Domain> {
    const domain = this.domains.get(id);
    if (!domain) {
      throw new NotFoundError("Domain", id);
    }
    const updated: Domain = { ...domain, name: input.name };
    this.domains.set(id, updated);
    return updated;
  }

  async listSubjects(domainId: string): Promise<Subject[]> {
    return [...this.subjects.values()]
      .filter((subject) => subject.domainId === domainId)
      .sort((a, b) => a.position - b.position);
  }

  async getSubject(id: string): Promise<Subject | null> {
    return this.subjects.get(id) ?? null;
  }

  async createSubject(domainId: string, input: { name: string }): Promise<Subject> {
    const siblings = await this.listSubjects(domainId);
    const subject: Subject = {
      id: randomUUID(),
      domainId,
      name: input.name,
      position: siblings.length === 0 ? 0 : siblings[siblings.length - 1].position + 1,
      createdAt: new Date().toISOString(),
    };
    this.subjects.set(subject.id, subject);
    return subject;
  }

  async updateSubject(id: string, input: { name: string }): Promise<Subject> {
    const subject = this.subjects.get(id);
    if (!subject) {
      throw new NotFoundError("Subject", id);
    }
    const updated: Subject = { ...subject, name: input.name };
    this.subjects.set(id, updated);
    return updated;
  }

  async reorderSubjects(domainId: string, subjectIds: string[]): Promise<void> {
    if (!this.domains.has(domainId)) {
      throw new NotFoundError("Domain", domainId);
    }
    const siblings = await this.listSubjects(domainId);
    assertSameSiblings("Subjects", siblings, subjectIds);
    subjectIds.forEach((id, position) => {
      this.subjects.set(id, { ...this.subjects.get(id)!, position });
    });
  }

  async listConcepts(subjectId: string): Promise<Concept[]> {
    return [...this.concepts.values()]
      .filter((concept) => concept.subjectId === subjectId)
      .sort((a, b) => a.position - b.position);
  }

  async getConcept(id: string): Promise<Concept | null> {
    return this.concepts.get(id) ?? null;
  }

  async createConcept(
    subjectId: string,
    input: { name: string; notes?: string | null },
  ): Promise<Concept> {
    const siblings = await this.listConcepts(subjectId);
    const concept: Concept = {
      id: randomUUID(),
      subjectId,
      name: input.name,
      notes: input.notes ?? null,
      position: siblings.length === 0 ? 0 : siblings[siblings.length - 1].position + 1,
      status: "planned",
      studiedAt: null,
      createdAt: new Date().toISOString(),
      reviewIntervalDays: null,
      reviewEaseFactor: null,
      nextReviewDueAt: null,
    };
    this.concepts.set(concept.id, concept);
    return concept;
  }

  async updateConcept(
    id: string,
    input: { name?: string; notes?: string | null },
  ): Promise<Concept> {
    const concept = this.concepts.get(id);
    if (!concept) {
      throw new NotFoundError("Concept", id);
    }
    const notesChanged = input.notes !== undefined && input.notes !== concept.notes;
    const currentSchedule = scheduleFromFields(concept);

    const schedule =
      notesChanged && concept.status === "studied" && currentSchedule
        ? pullReviewCloser(currentSchedule)
        : null;

    const updated: Concept = {
      ...concept,
      name: input.name ?? concept.name,
      notes: input.notes === undefined ? concept.notes : input.notes,
      ...(schedule
        ? {
            reviewIntervalDays: schedule.intervalDays,
            reviewEaseFactor: schedule.easeFactor,
            nextReviewDueAt: schedule.nextDueAt,
          }
        : {}),
    };
    this.concepts.set(id, updated);
    return updated;
  }

  async reorderConcepts(subjectId: string, conceptIds: string[]): Promise<void> {
    if (!this.subjects.has(subjectId)) {
      throw new NotFoundError("Subject", subjectId);
    }
    const siblings = await this.listConcepts(subjectId);
    assertSameSiblings("Concepts", siblings, conceptIds);
    conceptIds.forEach((id, position) => {
      this.concepts.set(id, { ...this.concepts.get(id)!, position });
    });
  }

  async setConceptStatus(id: string, status: ConceptStatus): Promise<Concept> {
    const concept = this.concepts.get(id);
    if (!concept) {
      throw new NotFoundError("Concept", id);
    }
    const schedule = status === "studied" ? initialReviewSchedule() : null;
    const updated: Concept = {
      ...concept,
      status,
      studiedAt: status === "studied" ? new Date().toISOString() : null,
      reviewIntervalDays: schedule?.intervalDays ?? null,
      reviewEaseFactor: schedule?.easeFactor ?? null,
      nextReviewDueAt: schedule?.nextDueAt ?? null,
    };
    this.concepts.set(id, updated);
    return updated;
  }

  async updateConceptReviewSchedule(
    id: string,
    schedule: { intervalDays: number; easeFactor: number; nextDueAt: string },
  ): Promise<Concept> {
    const concept = this.concepts.get(id);
    if (!concept) {
      throw new NotFoundError("Concept", id);
    }
    const updated: Concept = {
      ...concept,
      reviewIntervalDays: schedule.intervalDays,
      reviewEaseFactor: schedule.easeFactor,
      nextReviewDueAt: schedule.nextDueAt,
    };
    this.concepts.set(id, updated);
    return updated;
  }
}
