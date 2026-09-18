import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionsRepository } from "./repository";
import type { Attempt, Confidence, Correctness, Question, QuestionType } from "./types";

type QuestionRow = {
  id: string;
  concept_id: string;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  correct_option_index: number | null;
  created_at: string;
};

type AttemptRow = {
  id: string;
  question_id: string;
  submitted_answer: string;
  confidence: Confidence;
  correctness: Correctness;
  graded_explanation: string;
  created_at: string;
};

function toQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    conceptId: row.concept_id,
    type: row.type,
    prompt: row.prompt,
    options: row.options,
    correctOptionIndex: row.correct_option_index,
    createdAt: row.created_at,
  };
}

function toAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    questionId: row.question_id,
    submittedAnswer: row.submitted_answer,
    confidence: row.confidence,
    correctness: row.correctness,
    gradedExplanation: row.graded_explanation,
    createdAt: row.created_at,
  };
}

export class SupabaseQuestionsRepository implements QuestionsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createQuestion(input: {
    conceptId: string;
    type: QuestionType;
    prompt: string;
    options?: string[] | null;
    correctOptionIndex?: number | null;
  }): Promise<Question> {
    const { data, error } = await this.client
      .from("questions")
      .insert({
        concept_id: input.conceptId,
        type: input.type,
        prompt: input.prompt,
        options: input.options ?? null,
        correct_option_index: input.correctOptionIndex ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return toQuestion(data as QuestionRow);
  }

  async getQuestion(id: string): Promise<Question | null> {
    const { data, error } = await this.client
      .from("questions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toQuestion(data as QuestionRow) : null;
  }

  async createAttempt(input: {
    questionId: string;
    submittedAnswer: string;
    confidence: Confidence;
    correctness: Correctness;
    gradedExplanation: string;
  }): Promise<Attempt> {
    const { data, error } = await this.client
      .from("attempts")
      .insert({
        question_id: input.questionId,
        submitted_answer: input.submittedAnswer,
        confidence: input.confidence,
        correctness: input.correctness,
        graded_explanation: input.gradedExplanation,
      })
      .select()
      .single();
    if (error) throw error;
    return toAttempt(data as AttemptRow);
  }

  async getAttempt(id: string): Promise<Attempt | null> {
    const { data, error } = await this.client
      .from("attempts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toAttempt(data as AttemptRow) : null;
  }
}
