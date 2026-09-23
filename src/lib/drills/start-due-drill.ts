import type { LlmPort } from "@/lib/llm/port";
import { questionFieldsFromGenerated } from "@/lib/questions/from-generated";
import type { QuestionsRepository } from "@/lib/questions/repository";
import { scheduleFromFields } from "@/lib/study/scheduling";
import { NotFoundError } from "@/lib/syllabus/errors";
import { listDueConcepts } from "@/lib/syllabus/list-due-concepts";
import type { SyllabusRepository } from "@/lib/syllabus/repository";
import { composeDueDrill } from "./compose-drill";
import { DrillGenerationError, NoDueConceptsError } from "./errors";
import type { DrillsRepository } from "./repository";
import type { Drill } from "./types";

/**
 * Generates a Drill over the Concepts currently due in one Domain: composition
 * picks the Concepts and Question types first, then the LLM fills in the
 * content of each Question. Nothing is persisted until every Question has been
 * generated, so a failed generation leaves no half-built Drill behind.
 */
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
  const due = await listDueConcepts(deps.syllabusRepo, dueAsOf);
  const conceptsById = new Map(due.map((dueConcept) => [dueConcept.concept.id, dueConcept.concept]));

  // Every due Concept is offered to composition carrying its own Domain, so
  // the one-Domain rule (ADR 0001) is enforced where the Concepts are chosen.
  const plan = composeDueDrill({
    domainId: domain.id,
    maxQuestions: input.maxQuestions,
    candidates: due.map(({ concept, subject, domain: conceptDomain }) => ({
      conceptId: concept.id,
      domainId: conceptDomain.id,
      subjectId: subject.id,
      schedule: scheduleFromFields(concept),
    })),
  });

  if (plan.length === 0) {
    throw new NoDueConceptsError(domain.id);
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
    domainId: domain.id,
    scope: "due",
    // When the due-list was taken; the Drill's Questions record the rest.
    scopeDetail: { dueAsOf: dueAsOf.toISOString() },
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
