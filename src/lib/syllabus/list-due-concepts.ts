import type { SyllabusRepository } from "./repository";
import type { StudiedConcept } from "./types";

export type DueConcept = StudiedConcept;

/** Studied Concepts whose review schedule has come round, in syllabus order. */
export async function listDueConcepts(
  repo: SyllabusRepository,
  now: Date = new Date(),
): Promise<DueConcept[]> {
  return (await repo.listStudiedConcepts()).filter(
    ({ concept }) =>
      concept.nextReviewDueAt !== null && new Date(concept.nextReviewDueAt).getTime() <= now.getTime(),
  );
}
