import type { LlmPort } from "@/lib/llm/port";
import { questionFieldsFromGenerated } from "@/lib/questions/from-generated";
import type { QuestionsRepository } from "@/lib/questions/repository";
import { scheduleFromFields } from "@/lib/study/scheduling";
import { NotFoundError } from "@/lib/syllabus/errors";
import type { StudiedConcept } from "@/lib/syllabus/types";
import { composeDrill } from "./compose-drill";
import { DrillGenerationError } from "./errors";
import type { CreateDrillInput, DrillsRepository } from "./repository";
import type { Drill } from "./types";

/**
 * Generates a Drill over the given Concepts, whatever scope they were drawn
 * from: composition picks the Concepts and Question types first, then the LLM
 * fills in the content of each Question. Nothing is persisted until every
 * Question has been generated, so a failed generation leaves no half-built
 * Drill behind.
 *
 * Returns null when composition finds nothing to ask, leaving the caller to
 * say why in terms of its own scope.
 */
export async function generateDrill(
  deps: {
    drillsRepo: DrillsRepository;
    questionsRepo: QuestionsRepository;
    llmPort: LlmPort;
  },
  input: CreateDrillInput & { concepts: StudiedConcept[]; maxQuestions?: number },
): Promise<Drill | null> {
  const conceptsById = new Map(input.concepts.map(({ concept }) => [concept.id, concept]));

  // Every Concept is offered to composition carrying its own Domain, so the
  // one-Domain rule (ADR 0001) is enforced where the Concepts are chosen.
  const plan = composeDrill({
    domainId: input.domainId,
    maxQuestions: input.maxQuestions,
    candidates: input.concepts.map(({ concept, subject, domain }) => ({
      conceptId: concept.id,
      domainId: domain.id,
      subjectId: subject.id,
      schedule: scheduleFromFields(concept),
    })),
  });

  if (plan.length === 0) {
    return null;
  }

  const generated = await Promise.all(
    plan.map(async (planned) => {
      const concepts = planned.conceptIds.map((conceptId) => {
        const concept = conceptsById.get(conceptId);
        if (!concept) {
          throw new NotFoundError("Concept", conceptId);
        }
        return concept;
      });
      try {
        const content = await deps.llmPort.generateQuestion({
          concepts: concepts.map((concept) => ({ name: concept.name, notes: concept.notes })),
          type: planned.type,
        });
        return { conceptIds: planned.conceptIds, content };
      } catch (cause) {
        throw new DrillGenerationError(concepts.map((concept) => concept.name), { cause });
      }
    }),
  );

  const drill = await deps.drillsRepo.createDrill({
    domainId: input.domainId,
    scope: input.scope,
    scopeDetail: input.scopeDetail,
  });

  await deps.questionsRepo.createQuestions(
    generated.map(({ conceptIds, content }, position) => ({
      conceptIds,
      drillId: drill.id,
      position,
      ...questionFieldsFromGenerated(content),
    })),
  );

  return drill;
}
