import type { Attempt, Confidence, Correctness, Question, QuestionType } from "./types";

export type CreateAttemptInput = {
  questionId: string;
  submittedAnswer: string;
  confidence: Confidence;
  correctness: Correctness;
  gradedExplanation: string;
  referenceAnswer?: string | null;
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
  /** Attempts on one Drill's Questions, oldest first. */
  listDrillAttempts(drillId: string): Promise<Attempt[]>;
}
