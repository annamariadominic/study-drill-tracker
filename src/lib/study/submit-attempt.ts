import type { LlmPort } from "@/lib/llm/port";
import { NotFoundError } from "@/lib/questions/errors";
import type { QuestionsRepository } from "@/lib/questions/repository";
import type { Attempt, Confidence, Correctness, Question } from "@/lib/questions/types";
import type { SyllabusRepository } from "@/lib/syllabus/repository";
import { initialReviewSchedule, scheduleFromFields, scheduleNextReview } from "./scheduling";

/**
 * Whether this Attempt is the one that advances its Concept's review schedule.
 *
 * A Drill advances a Concept's schedule at most once (ADR 0006). Where the
 * Drill asks a recall Question about the Concept, that recall Attempt is the
 * signal, since producing the answer is stricter evidence than recognising it
 * or meeting the Concept inside a wider scenario. Where it doesn't, the one
 * Question the Drill does ask provides the update instead. Attempts that
 * aren't the signal are still recorded and graded.
 *
 * Outside a Drill every Attempt advances the schedule, as it always has.
 */
async function advancesReviewSchedule(
  questionsRepo: QuestionsRepository,
  question: Question,
): Promise<boolean> {
  if (!question.drillId) {
    return true;
  }

  const [conceptId] = question.conceptIds;
  const aboutSameConcept = (await questionsRepo.listDrillQuestions(question.drillId)).filter(
    (drillQuestion) => drillQuestion.conceptIds.includes(conceptId),
  );
  const recallQuestions = aboutSameConcept.filter(
    (drillQuestion) => drillQuestion.type === "recall",
  );
  const signalQuestions = recallQuestions.length > 0 ? recallQuestions : aboutSameConcept;

  if (!signalQuestions.some((drillQuestion) => drillQuestion.id === question.id)) {
    return false;
  }

  const alreadyAnswered = await questionsRepo.listAttemptsForQuestions(
    signalQuestions.map((drillQuestion) => drillQuestion.id),
  );
  return alreadyAnswered.length === 0;
}

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

  // Checked before the Attempt is recorded, so it doesn't count itself as an
  // earlier review of the Concept.
  const advancesSchedule = await advancesReviewSchedule(deps.questionsRepo, question);

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

  const concept = await deps.syllabusRepo.getConcept(question.conceptIds[0]);
  if (concept && concept.status === "studied" && advancesSchedule) {
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
