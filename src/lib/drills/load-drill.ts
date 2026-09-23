import type { QuestionsRepository } from "@/lib/questions/repository";
import type { Question } from "@/lib/questions/types";
import type { SyllabusRepository } from "@/lib/syllabus/repository";
import { drillProgress, type DrillProgress } from "./drill-progress";
import type { DrillsRepository } from "./repository";
import type { Drill } from "./types";

export type LoadedDrill = {
  drill: Drill;
  progress: DrillProgress;
};

/** A Drill together with how far through it the answers have got, or null if there's no such Drill. */
export async function loadDrill(
  deps: { drillsRepo: DrillsRepository; questionsRepo: QuestionsRepository },
  drillId: string,
): Promise<LoadedDrill | null> {
  const drill = await deps.drillsRepo.getDrill(drillId);
  if (!drill) {
    return null;
  }

  const questions = await deps.questionsRepo.listDrillQuestions(drill.id);
  const attempts = await deps.questionsRepo.listAttemptsForQuestions(
    questions.map((question) => question.id),
  );

  return { drill, progress: drillProgress(questions, attempts) };
}

/** Names the Concepts a set of Questions came from, for the end-of-Drill summary. */
export async function drillConceptNames(
  syllabusRepo: SyllabusRepository,
  questions: Question[],
): Promise<Map<string, string>> {
  const conceptIds = [...new Set(questions.flatMap((question) => question.conceptIds))];
  const named = await Promise.all(
    conceptIds.map(async (conceptId): Promise<[string, string]> => {
      const concept = await syllabusRepo.getConcept(conceptId);
      return [conceptId, concept?.name ?? "Unknown Concept"];
    }),
  );
  return new Map(named);
}
