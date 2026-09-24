import type { LlmPort } from "@/lib/llm/port";
import type { QuestionsRepository } from "@/lib/questions/repository";
import { NotFoundError } from "@/lib/syllabus/errors";
import { listDueConcepts } from "@/lib/syllabus/list-due-concepts";
import type { SyllabusRepository } from "@/lib/syllabus/repository";
import { NoDueConceptsError } from "./errors";
import { generateDrill } from "./generate-drill";
import type { DrillsRepository } from "./repository";
import type { Drill } from "./types";

/** Generates a Drill over the Concepts currently due in one Domain. */
export async function startDueDrill(
  deps: {
    syllabusRepo: SyllabusRepository;
    drillsRepo: DrillsRepository;
    questionsRepo: QuestionsRepository;
    llmPort: LlmPort;
  },
  input: { domainId: string; maxQuestions?: number; now?: Date },
): Promise<Drill> {
  const domain = await deps.syllabusRepo.getDomain(input.domainId);
  if (!domain) {
    throw new NotFoundError("Domain", input.domainId);
  }

  const dueAsOf = input.now ?? new Date();
  const drill = await generateDrill(deps, {
    domainId: domain.id,
    scope: "due",
    // When the due-list was taken; the Drill's Questions record the rest.
    scopeDetail: { dueAsOf: dueAsOf.toISOString() },
    // Due Concepts from every Domain; composition keeps only this one's.
    concepts: await listDueConcepts(deps.syllabusRepo, dueAsOf),
    maxQuestions: input.maxQuestions,
  });

  if (!drill) {
    throw new NoDueConceptsError(domain.id);
  }
  return drill;
}
