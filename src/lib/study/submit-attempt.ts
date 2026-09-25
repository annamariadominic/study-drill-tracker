import type { LlmPort, QuestionConcept } from "@/lib/llm/port";
import { NotFoundError } from "@/lib/questions/errors";
import type { QuestionsRepository } from "@/lib/questions/repository";
import type { Attempt, Confidence, Correctness, Question } from "@/lib/questions/types";
import type { SyllabusRepository } from "@/lib/syllabus/repository";
import { initialReviewSchedule, scheduleFromFields, scheduleNextReview } from "./scheduling";

/**
 * The Concepts whose review schedule this Attempt advances.
 *
 * A Drill advances each Concept's schedule at most once (ADR 0006). Where the
 * Drill asks a recall Question about the Concept, that recall Attempt is the
 * signal, since producing the answer is stricter evidence than recognising it
 * or meeting the Concept inside a wider scenario. Where it doesn't, the first
 * Attempt on whatever the Drill does ask about it provides the update instead
 * — so a scenario advances each Concept it combines that the Drill hasn't
 * scheduled some other way. Attempts that aren't the signal are still
 * recorded and graded.
 *
 * Outside a Drill every Attempt advances the schedule of each of its Concepts.
 */
async function conceptsToAdvance(
  questionsRepo: QuestionsRepository,
  question: Question,
): Promise<string[]> {
  if (!question.drillId) {
    return question.conceptIds;
  }

  const [drillQuestions, drillAttempts] = await Promise.all([
    questionsRepo.listDrillQuestions(question.drillId),
    questionsRepo.listDrillAttempts(question.drillId),
  ]);
  const attemptedQuestionIds = new Set(drillAttempts.map((attempt) => attempt.questionId));

  return question.conceptIds.filter((conceptId) => {
    const aboutConcept = drillQuestions.filter((drillQuestion) =>
      drillQuestion.conceptIds.includes(conceptId),
    );
    const recallQuestions = aboutConcept.filter((drillQuestion) => drillQuestion.type === "recall");
    const signalQuestions = recallQuestions.length > 0 ? recallQuestions : aboutConcept;

    return (
      signalQuestions.some((drillQuestion) => drillQuestion.id === question.id) &&
      !signalQuestions.some((drillQuestion) => attemptedQuestionIds.has(drillQuestion.id))
    );
  });
}

/** The Concepts a Question asks about, as the grader sees them. */
async function gradingConcepts(
  syllabusRepo: SyllabusRepository,
  question: Question,
): Promise<QuestionConcept[]> {
  const concepts = await Promise.all(question.conceptIds.map((conceptId) => syllabusRepo.getConcept(conceptId)));
  return concepts.flatMap((concept) => (concept ? [{ name: concept.name, notes: concept.notes }] : []));
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
  // earlier review of the Concept. The grader's Concepts are read alongside
  // (a flashcard doesn't need them), rather than after.
  const [advancingConceptIds, concepts] = await Promise.all([
    conceptsToAdvance(deps.questionsRepo, question),
    question.type === "flashcard" ? [] : gradingConcepts(deps.syllabusRepo, question),
  ]);

  let correctness: Correctness;
  let gradedExplanation: string;
  let referenceAnswer: string | null = null;
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
      question: { type: question.type, prompt: question.prompt },
      concepts,
      submittedAnswer,
    });
    correctness = graded.correctness;
    gradedExplanation = graded.explanation;
    referenceAnswer = graded.referenceAnswer;
  }

  const attempt = await deps.questionsRepo.createAttempt({
    questionId: question.id,
    submittedAnswer,
    confidence: input.confidence,
    correctness,
    gradedExplanation,
    referenceAnswer,
  });

  await Promise.all(
    advancingConceptIds.map(async (conceptId) => {
      const concept = await deps.syllabusRepo.getConcept(conceptId);
      if (!concept || concept.status !== "studied") {
        return;
      }
      const currentSchedule = scheduleFromFields(concept) ?? initialReviewSchedule();
      const nextSchedule = scheduleNextReview(currentSchedule, { correctness, confidence: input.confidence });
      try {
        await deps.syllabusRepo.updateConceptReviewSchedule(concept.id, nextSchedule);
      } catch {
        // The Attempt is already recorded and graded; a failure to advance the
        // review schedule shouldn't be reported to the user as a failed attempt.
      }
    }),
  );

  return attempt;
}
