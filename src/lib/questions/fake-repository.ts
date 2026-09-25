import { randomUUID } from "node:crypto";
import { assertQuestionConcepts } from "./concepts";
import type { CreateAttemptInput, CreateQuestionInput, QuestionsRepository } from "./repository";
import type { Attempt, AttemptGrade, GradedAttempt, GradingStatus, Question } from "./types";

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
    const base = {
      id: randomUUID(),
      questionId: input.questionId,
      submittedAnswer: input.submittedAnswer,
      confidence: input.confidence,
      advancesConceptIds: [...input.advancesConceptIds],
      createdAt: new Date().toISOString(),
    };
    const attempt: Attempt = input.grade
      ? { ...base, gradingStatus: "graded", ...input.grade }
      : { ...base, gradingStatus: "pending", correctness: null, gradedExplanation: null, referenceAnswer: null };
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  async recordGrade(id: string, grade: AttemptGrade): Promise<GradedAttempt | null> {
    const attempt = this.attempts.get(id);
    if (attempt?.gradingStatus !== "pending") {
      return null;
    }
    const graded: GradedAttempt = { ...attempt, gradingStatus: "graded", ...grade };
    this.attempts.set(id, graded);
    return graded;
  }

  async markGradingFailed(id: string): Promise<Attempt | null> {
    return this.moveUngraded(id, "pending", "failed");
  }

  async reopenFailedGrading(id: string): Promise<Attempt | null> {
    return this.moveUngraded(id, "failed", "pending");
  }

  private moveUngraded(id: string, from: GradingStatus, to: "pending" | "failed"): Attempt | null {
    const attempt = this.attempts.get(id);
    if (!attempt || attempt.gradingStatus !== from || attempt.gradingStatus === "graded") {
      return null;
    }
    const moved: Attempt = { ...attempt, gradingStatus: to };
    this.attempts.set(id, moved);
    return moved;
  }

  async getAttempt(id: string): Promise<Attempt | null> {
    return this.attempts.get(id) ?? null;
  }

  async listDrillAttempts(drillId: string): Promise<Attempt[]> {
    return [...this.attempts.values()].filter(
      (attempt) => this.questions.get(attempt.questionId)?.drillId === drillId,
    );
  }
}
