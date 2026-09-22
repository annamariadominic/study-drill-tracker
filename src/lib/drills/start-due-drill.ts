import type { LlmPort } from "@/lib/llm/port";
import type { QuestionsRepository } from "@/lib/questions/repository";
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

  const due = (await listDueConcepts(deps.syllabusRepo, input.now)).filter(
    (dueConcept) => dueConcept.domain.id === domain.id,
  );
  const conceptsById = new Map(due.map((dueConcept) => [dueConcept.concept.id, dueConcept.concept]));

  const plan = composeDueDrill({
    domainId: domain.id,
    maxQuestions: input.maxQuestions,
    candidates: due.map(({ concept }) => ({
      conceptId: concept.id,
      domainId: domain.id,
      reviewIntervalDays: concept.reviewIntervalDays,
      reviewEaseFactor: concept.reviewEaseFactor,
      // A due Concept always has a next-due date; the fallback just keeps the
      // ordering total.
      dueAt: concept.nextReviewDueAt ?? concept.createdAt,
    })),
  });

  if (plan.length === 0) {
    throw new NoDueConceptsError(domain.id);
  }

  const generated = await Promise.all(
    plan.map(async (planned) => {
      const concept = conceptsById.get(planned.conceptId);
      if (!concept) {
        throw new NotFoundError("Concept", planned.conceptId);
      }
      try {
        const content = await deps.llmPort.generateQuestion({
          conceptName: concept.name,
          conceptNotes: concept.notes,
          type: planned.type,
        });
        return { conceptId: concept.id, content };
      } catch (cause) {
        throw new DrillGenerationError(concept.name, { cause });
      }
    }),
  );

  const drill = await deps.drillsRepo.createDrill({ domainId: domain.id, scope: "due" });

  for (const [position, { conceptId, content }] of generated.entries()) {
    await deps.questionsRepo.createQuestion({
      conceptId,
      drillId: drill.id,
      position,
      type: content.type,
      prompt: content.prompt,
      options: content.type === "flashcard" ? content.options : null,
      correctOptionIndex: content.type === "flashcard" ? content.correctOptionIndex : null,
    });
  }

  return drill;
}
