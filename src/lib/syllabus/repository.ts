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
  setConceptStatus(id: string, status: ConceptStatus): Promise<Concept>;
}
