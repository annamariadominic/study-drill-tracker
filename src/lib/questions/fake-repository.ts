import { randomUUID } from "node:crypto";
import { assertQuestionConcepts } from "./concepts";
import type { CreateAttemptInput, CreateQuestionInput, QuestionsRepository } from "./repository";
import type { Attempt, Question } from "./types";

export class FakeQuestionsRepository implements QuestionsRepository {
  private questions = new Map<string, Question>();
  private attempts = new Map<string, Attempt>();

  async createQuestion(input: CreateQuestionInput): Promise<Question> {
    assertQuestionConcepts(input);
    const question: Question = {
      id: randomUUID(),
      conceptIds: [...input.conceptIds],
      drillId: input.drillId ?? null,
      position: input.position ?? null,
      type: input.type,
      prompt: input.prompt,
      options: input.options ?? null,
      correctOptionIndex: input.correctOptionIndex ?? null,
      createdAt: new Date().toISOString(),
    };
    this.questions.set(question.id, question);
    return question;
  }

  async createQuestions(inputs: CreateQuestionInput[]): Promise<Question[]> {
    // Checked up front, so a bad Question leaves none of the batch behind.
    inputs.forEach(assertQuestionConcepts);
    const created: Question[] = [];
    for (const input of inputs) {
      created.push(await this.createQuestion(input));
    }
    return created;
  }

  async getQuestion(id: string): Promise<Question | null> {
    return this.questions.get(id) ?? null;
  }

  async listDrillQuestions(drillId: string): Promise<Question[]> {
    return [...this.questions.values()]
      .filter((question) => question.drillId === drillId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  async createAttempt(input: CreateAttemptInput): Promise<Attempt> {
    const attempt: Attempt = {
      id: randomUUID(),
      questionId: input.questionId,
      submittedAnswer: input.submittedAnswer,
      confidence: input.confidence,
      correctness: input.correctness,
      gradedExplanation: input.gradedExplanation,
      referenceAnswer: input.referenceAnswer ?? null,
      createdAt: new Date().toISOString(),
    };
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  async getAttempt(id: string): Promise<Attempt | null> {
    return this.attempts.get(id) ?? null;
  }

  async listAttemptsForQuestions(questionIds: string[]): Promise<Attempt[]> {
    const wanted = new Set(questionIds);
    return [...this.attempts.values()].filter((attempt) => wanted.has(attempt.questionId));
  }
}
