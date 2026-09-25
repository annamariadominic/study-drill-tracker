import type { Attempt, AttemptGrade, Confidence, GradedAttempt, Question, QuestionType } from "./types";

export type CreateAttemptInput = {
  questionId: string;
  submittedAnswer: string;
  confidence: Confidence;
  advancesConceptIds: string[];
  /** Given for an Attempt graded as it's recorded; left out, the Attempt is recorded as grading pending. */
  grade?: AttemptGrade;
};

export type CreateQuestionInput = {
  conceptIds: string[];
  type: QuestionType;
  prompt: string;
  options?: string[] | null;
  correctOptionIndex?: number | null;
  drillId?: string | null;
  position?: number | null;
};

export interface QuestionsRepository {
  createQuestion(input: CreateQuestionInput): Promise<Question>;
  /**
   * Creates several Questions as one unit, so a Drill's Questions land
   * together. Throws QuestionIntegrityError, creating none, if any Question
   * has the wrong Concepts for its type.
   */
  createQuestions(inputs: CreateQuestionInput[]): Promise<Question[]>;
  getQuestion(id: string): Promise<Question | null>;
  /** Questions of one Drill, in the order they should be asked. */
  listDrillQuestions(drillId: string): Promise<Question[]>;

  createAttempt(input: CreateAttemptInput): Promise<Attempt>;
  getAttempt(id: string): Promise<Attempt | null>;
  /**
   * Stores the grade of a pending Attempt. Returns null, changing nothing, if
   * the Attempt isn't pending — so of two gradings racing on one Attempt, only
   * one records its grade and goes on to advance the schedule.
   */
  recordGrade(id: string, grade: AttemptGrade): Promise<GradedAttempt | null>;
  /** Marks a pending Attempt's grading as failed; null, changing nothing, if it isn't pending. */
  markGradingFailed(id: string): Promise<Attempt | null>;
  /**
   * Puts an Attempt back to pending for another try, restarting its grading
   * clock: one that failed, or one still pending whose grading started before
   * `stalledBefore` and so can no longer finish. Null, changing nothing, for
   * any other Attempt.
   */
  reopenGrading(id: string, stalledBefore: string): Promise<Attempt | null>;
  /** Attempts on one Drill's Questions, oldest first. */
  listDrillAttempts(drillId: string): Promise<Attempt[]>;
}
