import type { SyllabusRepository } from "./repository";
import type { Concept, Domain, Subject } from "./types";

export type DueConcept = {
  concept: Concept;
  subject: Subject;
  domain: Domain;
};

export async function listDueConcepts(
  repo: SyllabusRepository,
  now: Date = new Date(),
): Promise<DueConcept[]> {
  const domains = await repo.listDomains();

  const perDomain = await Promise.all(
    domains.map(async (domain) => {
      const subjects = await repo.listSubjects(domain.id);
      const perSubject = await Promise.all(
        subjects.map(async (subject) => {
          const concepts = await repo.listConcepts(subject.id);
          return concepts
            .filter(
              (concept) =>
                concept.status === "studied" &&
                concept.nextReviewDueAt !== null &&
                new Date(concept.nextReviewDueAt).getTime() <= now.getTime(),
            )
            .map((concept) => ({ concept, subject, domain }));
        }),
      );
      return perSubject.flat();
    }),
  );

  return perDomain.flat();
}
