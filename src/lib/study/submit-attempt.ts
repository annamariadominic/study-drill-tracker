import type { LlmPort, QuestionConcept } from "@/lib/llm/port";
import { NotFoundError } from "@/lib/questions/errors";
import type { QuestionsRepository } from "@/lib/questions/repository";
import type { Attempt, AttemptGrade, Confidence, GradedAttempt, Question } from "@/lib/questions/types";
import type { SyllabusRepository } from "@/lib/syllabus/repository";
import { GradingNotFailedError } from "./errors";
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
 * recorded and graded. An Attempt still waiting on its grade counts as the
 * signal just as a graded one does; the update itself waits for the grade.
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

/**
 * Records an answer. A flashcard is graded mechanically and its review
 * schedule advanced at once. A recall or scenario answer is recorded as
 * grading pending and returned without waiting on the LLM: gradeAttempt grades
 * it afterwards (ADR 0011). Which Concepts it advances is decided here all the
 * same, and stored on the Attempt for the grade to apply.
 */
export async function submitAttempt(
  deps: { questionsRepo: QuestionsRepository; syllabusRepo: SyllabusRepository },
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

  if (question.type !== "flashcard") {
    // Checked before the Attempt is recorded, so it doesn't count itself as an
    // earlier review of the Concept.
    const advancesConceptIds = await conceptsToAdvance(deps.questionsRepo, question);
    return deps.questionsRepo.createAttempt({
      questionId: question.id,
      submittedAnswer: input.submittedAnswer ?? "",
      confidence: input.confidence,
      advancesConceptIds,
    });
  }

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

  const attempt = await deps.questionsRepo.createAttempt({
    questionId: question.id,
    submittedAnswer: question.options[input.selectedOptionIndex],
    confidence: input.confidence,
    advancesConceptIds: await conceptsToAdvance(deps.questionsRepo, question),
    grade: {
      correctness: isCorrect ? "correct" : "incorrect",
      gradedExplanation: isCorrect
        ? `Correct — the answer is "${correctOptionText}".`
        : `Not quite — the correct answer is "${correctOptionText}".`,
      referenceAnswer: null,
    },
  });
  if (attempt.gradingStatus === "graded") {
    await advanceSchedules(deps.syllabusRepo, attempt);
  }
  return attempt;
}

/**
 * Grades a pending free-text Attempt with the LLM, then advances the review
 * schedule of the Concepts it was decided to advance. If grading fails the
 * Attempt is marked failed, advancing nothing, and returned rather than
 * thrown: this runs after the learner has already had their response.
 *
 * An Attempt that isn't pending is returned as it is, so grading one twice
 * never advances its schedule twice.
 */
export async function gradeAttempt(
  deps: { questionsRepo: QuestionsRepository; syllabusRepo: SyllabusRepository; llmPort: LlmPort },
  attemptId: string,
): Promise<Attempt> {
  const attempt = await deps.questionsRepo.getAttempt(attemptId);
  if (!attempt) {
    throw new NotFoundError("Attempt", attemptId);
  }
  if (attempt.gradingStatus !== "pending") {
    return attempt;
  }

  let graded: GradedAttempt | null;
  try {
    const question = await deps.questionsRepo.getQuestion(attempt.questionId);
    if (!question) {
      throw new NotFoundError("Question", attempt.questionId);
    }
    if (question.type === "flashcard") {
      throw new Error("A flashcard Attempt is graded as it's recorded");
    }
    const result = await deps.llmPort.gradeAnswer({
      question: { type: question.type, prompt: question.prompt },
      concepts: await gradingConcepts(deps.syllabusRepo, question),
      submittedAnswer: attempt.submittedAnswer,
    });
    const grade: AttemptGrade = {
      correctness: result.correctness,
      gradedExplanation: result.explanation,
      referenceAnswer: result.referenceAnswer,
    };
    graded = await deps.questionsRepo.recordGrade(attempt.id, grade);
  } catch {
    return (await deps.questionsRepo.markGradingFailed(attempt.id)) ?? (await currentAttempt(deps.questionsRepo, attempt));
  }

  if (!graded) {
    // Another grading of the same Attempt got there first and has advanced
    // the schedule itself.
    return currentAttempt(deps.questionsRepo, attempt);
  }
  await advanceSchedules(deps.syllabusRepo, graded);
  return graded;
}

/** Puts a failed Attempt back to pending, ready for gradeAttempt to try again. */
export async function retryGrading(
  deps: { questionsRepo: QuestionsRepository },
  attemptId: string,
): Promise<Attempt> {
  const reopened = await deps.questionsRepo.reopenFailedGrading(attemptId);
  if (reopened) {
    return reopened;
  }
  if (!(await deps.questionsRepo.getAttempt(attemptId))) {
    throw new NotFoundError("Attempt", attemptId);
  }
  throw new GradingNotFailedError(attemptId);
}

async function currentAttempt(questionsRepo: QuestionsRepository, attempt: Attempt): Promise<Attempt> {
  return (await questionsRepo.getAttempt(attempt.id)) ?? attempt;
}

/** Applies a graded Attempt to the review schedule of each Concept it advances. */
async function advanceSchedules(syllabusRepo: SyllabusRepository, attempt: GradedAttempt) {
  await Promise.all(
    attempt.advancesConceptIds.map(async (conceptId) => {
      const concept = await syllabusRepo.getConcept(conceptId);
      if (!concept || concept.status !== "studied") {
        return;
      }
      const currentSchedule = scheduleFromFields(concept) ?? initialReviewSchedule();
      const nextSchedule = scheduleNextReview(currentSchedule, {
        correctness: attempt.correctness,
        confidence: attempt.confidence,
      });
      try {
        await syllabusRepo.updateConceptReviewSchedule(concept.id, nextSchedule);
      } catch {
        // The Attempt is already recorded and graded; a failure to advance the
        // review schedule shouldn't be reported to the user as a failed attempt.
      }
    }),
  );
}
