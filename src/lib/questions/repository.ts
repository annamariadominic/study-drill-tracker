import type { Attempt, Confidence, Correctness, Question, QuestionType } from "./types";

export interface QuestionsRepository {
  createQuestion(input: {
    conceptId: string;
    type: QuestionType;
    prompt: string;
    options?: string[] | null;
    correctOptionIndex?: number | null;
  }): Promise<Question>;
  getQuestion(id: string): Promise<Question | null>;

  createAttempt(input: {
    questionId: string;
    submittedAnswer: string;
    confidence: Confidence;
    correctness: Correctness;
    gradedExplanation: string;
  }): Promise<Attempt>;
  getAttempt(id: string): Promise<Attempt | null>;
}
