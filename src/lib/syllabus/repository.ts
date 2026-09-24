import type { Concept, ConceptStatus, Domain, Subject } from "./types";

export interface SyllabusRepository {
  listDomains(): Promise<Domain[]>;
  getDomain(id: string): Promise<Domain | null>;
  createDomain(input: { name: string }): Promise<Domain>;
  updateDomain(id: string, input: { name: string }): Promise<Domain>;

  listSubjects(domainId: string): Promise<Subject[]>;
  getSubject(id: string): Promise<Subject | null>;
  createSubject(domainId: string, input: { name: string }): Promise<Subject>;
  updateSubject(id: string, input: { name: string }): Promise<Subject>;
  /**
   * Puts a Domain's Subjects in the given order. `subjectIds` must be exactly
   * that Domain's Subjects, each once; otherwise nothing changes.
   */
  reorderSubjects(domainId: string, subjectIds: string[]): Promise<void>;

  listConcepts(subjectId: string): Promise<Concept[]>;
  getConcept(id: string): Promise<Concept | null>;
  createConcept(
    subjectId: string,
    input: { name: string; notes?: string | null },
  ): Promise<Concept>;
  updateConcept(
    id: string,
    input: { name?: string; notes?: string | null },
  ): Promise<Concept>;
  /**
   * Puts a Subject's Concepts in the given order. `conceptIds` must be exactly
   * that Subject's Concepts, each once; otherwise nothing changes. Changes only
   * the order, never a Concept's status or review schedule.
   */
  reorderConcepts(subjectId: string, conceptIds: string[]): Promise<void>;
  setConceptStatus(id: string, status: ConceptStatus): Promise<Concept>;
  updateConceptReviewSchedule(
    id: string,
    schedule: { intervalDays: number; easeFactor: number; nextDueAt: string },
  ): Promise<Concept>;
}
