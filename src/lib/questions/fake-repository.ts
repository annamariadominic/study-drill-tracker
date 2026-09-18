import { randomUUID } from "node:crypto";
import type { QuestionsRepository } from "./repository";
import type { Attempt, Confidence, Correctness, Question, QuestionType } from "./types";

export class FakeQuestionsRepository implements QuestionsRepository {
  private questions = new Map<string, Question>();
  private attempts = new Map<string, Attempt>();

  async createQuestion(input: {
    conceptId: string;
    type: QuestionType;
    prompt: string;
    options?: string[] | null;
    correctOptionIndex?: number | null;
  }): Promise<Question> {
    const question: Question = {
      id: randomUUID(),
      conceptId: input.conceptId,
      type: input.type,
      prompt: input.prompt,
      options: input.options ?? null,
      correctOptionIndex: input.correctOptionIndex ?? null,
      createdAt: new Date().toISOString(),
    };
    this.questions.set(question.id, question);
    return question;
  }

  async getQuestion(id: string): Promise<Question | null> {
    return this.questions.get(id) ?? null;
  }

  async createAttempt(input: {
    questionId: string;
    submittedAnswer: string;
    confidence: Confidence;
    correctness: Correctness;
    gradedExplanation: string;
  }): Promise<Attempt> {
    const attempt: Attempt = {
      id: randomUUID(),
      questionId: input.questionId,
      submittedAnswer: input.submittedAnswer,
      confidence: input.confidence,
      correctness: input.correctness,
      gradedExplanation: input.gradedExplanation,
      createdAt: new Date().toISOString(),
    };
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  async getAttempt(id: string): Promise<Attempt | null> {
    return this.attempts.get(id) ?? null;
  }
}
