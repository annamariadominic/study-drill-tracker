import { QuestionIntegrityError } from "./errors";
import type { QuestionType } from "./types";

/**
 * A recall or flashcard Question asks about exactly one Concept; a scenario
 * combines two or more distinct Concepts. Throws QuestionIntegrityError
 * otherwise.
 */
export function assertQuestionConcepts(
  question: { id?: string; type: QuestionType; conceptIds: string[] },
): void {
  const { type, conceptIds } = question;
  const label = question.id ? `Question ${question.id}` : `New ${type} Question`;

  if (new Set(conceptIds).size !== conceptIds.length) {
    throw new QuestionIntegrityError(`${label} names the same Concept more than once`);
  }
  if (type === "scenario") {
    if (conceptIds.length < 2) {
      throw new QuestionIntegrityError(
        `${label} is a scenario but has ${conceptIds.length} Concept(s); it needs at least 2`,
      );
    }
  } else if (conceptIds.length !== 1) {
    throw new QuestionIntegrityError(
      `${label} is a ${type} Question but has ${conceptIds.length} Concepts; it needs exactly 1`,
    );
  }
}
