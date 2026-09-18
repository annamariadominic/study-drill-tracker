import type { LlmPort } from "@/lib/llm/port";
import { NotFoundError } from "@/lib/questions/errors";
import type { QuestionsRepository } from "@/lib/questions/repository";
import type { Attempt, Confidence, Correctness } from "@/lib/questions/types";
import type { SyllabusRepository } from "@/lib/syllabus/repository";
import { initialReviewSchedule, scheduleFromFields, scheduleNextReview } from "./scheduling";

export async function submitAttempt(
  deps: { questionsRepo: QuestionsRepository; syllabusRepo: SyllabusRepository; llmPort: LlmPort },
  input: {
    questionId: string;
    confidence: Confidence;
    submittedAnswer?: string;
    selectedOptionIndex?: number;
  },
): Promise<Attempt> {
  const question = await deps.questionsRepo.getQuestion(input.questionId);
  if (!question) {
    throw new NotFoundError("Question", input.questionId);
  }

  let correctness: Correctness;
  let gradedExplanation: string;
  let submittedAnswer: string;

  if (question.type === "flashcard") {
    if (
      input.selectedOptionIndex === undefined ||
      !question.options ||
      !Number.isInteger(input.selectedOptionIndex) ||
      input.selectedOptionIndex < 0 ||
      input.selectedOptionIndex >= question.options.length
    ) {
      throw new Error("selectedOptionIndex is required and must be a valid option index");
    }
    const correctOptionText = question.options[question.correctOptionIndex ?? -1];
    const isCorrect = input.selectedOptionIndex === question.correctOptionIndex;
    correctness = isCorrect ? "correct" : "incorrect";
    gradedExplanation = isCorrect
      ? `Correct — the answer is "${correctOptionText}".`
      : `Not quite — the correct answer is "${correctOptionText}".`;
    submittedAnswer = question.options[input.selectedOptionIndex];
  } else {
    submittedAnswer = input.submittedAnswer ?? "";
    const graded = await deps.llmPort.gradeAnswer({
      prompt: question.prompt,
      submittedAnswer,
    });
    correctness = graded.correctness;
    gradedExplanation = graded.explanation;
  }

  const attempt = await deps.questionsRepo.createAttempt({
    questionId: question.id,
    submittedAnswer,
    confidence: input.confidence,
    correctness,
    gradedExplanation,
  });

  const concept = await deps.syllabusRepo.getConcept(question.conceptId);
  if (concept && concept.status === "studied") {
    const currentSchedule = scheduleFromFields(concept) ?? initialReviewSchedule();
    const nextSchedule = scheduleNextReview(currentSchedule, { correctness, confidence: input.confidence });
    try {
      await deps.syllabusRepo.updateConceptReviewSchedule(concept.id, nextSchedule);
    } catch {
      // The Attempt is already recorded and graded; a failure to advance the
      // review schedule shouldn't be reported to the user as a failed attempt.
    }
  }

  return attempt;
}
