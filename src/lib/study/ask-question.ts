import type { LlmPort } from "@/lib/llm/port";
import { questionFieldsFromGenerated } from "@/lib/questions/from-generated";
import type { QuestionsRepository } from "@/lib/questions/repository";
import type { Question, QuestionType } from "@/lib/questions/types";
import { NotFoundError } from "@/lib/syllabus/errors";
import type { SyllabusRepository } from "@/lib/syllabus/repository";
import { ConceptNotStudiedError } from "./errors";

export async function askQuestion(
  deps: {
    syllabusRepo: SyllabusRepository;
    questionsRepo: QuestionsRepository;
    llmPort: LlmPort;
  },
  input: { conceptId: string; type: QuestionType },
): Promise<Question> {
  const concept = await deps.syllabusRepo.getConcept(input.conceptId);
  if (!concept) {
    throw new NotFoundError("Concept", input.conceptId);
  }
  if (concept.status !== "studied") {
    throw new ConceptNotStudiedError(concept.id);
  }

  const generated = await deps.llmPort.generateQuestion({
    conceptName: concept.name,
    conceptNotes: concept.notes,
    type: input.type,
  });

  return deps.questionsRepo.createQuestion({
    conceptId: concept.id,
    ...questionFieldsFromGenerated(generated),
  });
}
