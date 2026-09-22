import type { Attempt, Confidence, Correctness, Question, QuestionType } from "./types";

export type CreateQuestionInput = {
  conceptId: string;
  type: QuestionType;
  prompt: string;
  options?: string[] | null;
  correctOptionIndex?: number | null;
  drillId?: string | null;
  position?: number | null;
};

export interface QuestionsRepository {
  createQuestion(input: CreateQuestionInput): Promise<Question>;
  getQuestion(id: string): Promise<Question | null>;
  /** Questions of one Drill, in the order they should be asked. */
  listDrillQuestions(drillId: string): Promise<Question[]>;

  createAttempt(input: {
    questionId: string;
    submittedAnswer: string;
    confidence: Confidence;
    correctness: Correctness;
    gradedExplanation: string;
  }): Promise<Attempt>;
  getAttempt(id: string): Promise<Attempt | null>;
  listAttemptsForQuestions(questionIds: string[]): Promise<Attempt[]>;
}
