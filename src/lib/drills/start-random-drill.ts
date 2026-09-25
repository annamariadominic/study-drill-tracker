import type { LlmPort } from "@/lib/llm/port";
import type { QuestionsRepository } from "@/lib/questions/repository";
import { ConceptNotStudiedError } from "@/lib/study/errors";
import { NotFoundError } from "@/lib/syllabus/errors";
import type { SyllabusRepository } from "@/lib/syllabus/repository";
import type { StudiedConcept } from "@/lib/syllabus/types";
import { MixedDomainsError, NoStudiedConceptsError } from "./errors";
import { DEFAULT_MAX_QUESTIONS, roomForEveryConcept } from "./compose-drill";
import { generateDrill } from "./generate-drill";
import type { DrillsRepository } from "./repository";
import type { Drill, RandomDrillScope } from "./types";

/**
 * The one Domain a random Drill draws on and the studied Concepts in scope.
 * Anything other than a whole-library scope settles the Domain itself: a
 * Subject sits in one, and hand-picked Concepts must all share one (ADR 0001).
 * The whole library draws its Domain by picking a studied Concept at random,
 * so a Domain comes up in proportion to how much of the library it holds.
 */
async function conceptsInScope(
  syllabusRepo: SyllabusRepository,
  scope: RandomDrillScope,
  random: () => number,
): Promise<{ domainId: string; concepts: StudiedConcept[] }> {
  const studied = await syllabusRepo.listStudiedConcepts();

  let concepts: StudiedConcept[];
  switch (scope.kind) {
    case "library": {
      if (studied.length === 0) {
        throw new NoStudiedConceptsError();
      }
      const drawn = studied[Math.min(Math.floor(random() * studied.length), studied.length - 1)];
      concepts = studied.filter(({ domain }) => domain.id === drawn.domain.id);
      break;
    }
    case "subject": {
      const subject = await syllabusRepo.getSubject(scope.subjectId);
      if (!subject) {
        throw new NotFoundError("Subject", scope.subjectId);
      }
      concepts = studied.filter(({ subject: { id } }) => id === subject.id);
      break;
    }
    case "concepts": {
      const studiedById = new Map(studied.map((drillConcept) => [drillConcept.concept.id, drillConcept]));
      concepts = await Promise.all(
        scope.conceptIds.map(async (conceptId) => {
          const picked = studiedById.get(conceptId);
          if (picked) {
            return picked;
          }
          if (!(await syllabusRepo.getConcept(conceptId))) {
            throw new NotFoundError("Concept", conceptId);
          }
          throw new ConceptNotStudiedError(conceptId);
        }),
      );
      const domainIds = [...new Set(concepts.map(({ domain }) => domain.id))];
      if (domainIds.length > 1) {
        throw new MixedDomainsError(domainIds);
      }
      break;
    }
  }

  if (concepts.length === 0) {
    throw new NoStudiedConceptsError();
  }
  return { domainId: concepts[0].domain.id, concepts };
}

/** The scope as stored on the Drill, with any repeated Concept picks dropped. */
function normalizedScope(scope: RandomDrillScope): RandomDrillScope {
  return scope.kind === "concepts" ? { kind: "concepts", conceptIds: [...new Set(scope.conceptIds)] } : scope;
}

/**
 * Generates a Drill on demand, whether or not anything is due, drawing on
 * every studied Concept in its scope. It goes through the same composition,
 * generation and — once answered — scheduling as a due Drill; only where the
 * Concepts come from differs.
 */
export async function startRandomDrill(
  deps: {
    syllabusRepo: SyllabusRepository;
    drillsRepo: DrillsRepository;
    questionsRepo: QuestionsRepository;
    llmPort: LlmPort;
  },
  input: { scope: RandomDrillScope; maxQuestions?: number; random?: () => number },
): Promise<Drill> {
  const scope = normalizedScope(input.scope);
  const { domainId, concepts } = await conceptsInScope(
    deps.syllabusRepo,
    scope,
    input.random ?? Math.random,
  );

  const maxQuestions = input.maxQuestions ?? DEFAULT_MAX_QUESTIONS;
  const drill = await generateDrill(deps, {
    domainId,
    scope: "random",
    scopeDetail: scope,
    concepts,
    // Hand-picked Concepts were each chosen to be drilled, so none is left
    // out for want of room, however many were picked.
    maxQuestions:
      scope.kind === "concepts" ? Math.max(maxQuestions, roomForEveryConcept(concepts.length)) : maxQuestions,
  });

  if (!drill) {
    throw new NoStudiedConceptsError();
  }
  return drill;
}
