import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateQuestionInput, QuestionsRepository } from "./repository";
import type { Attempt, Confidence, Correctness, Question, QuestionType } from "./types";

type QuestionRow = {
  id: string;
  concept_id: string;
  drill_id: string | null;
  position: number | null;
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
    drillId: row.drill_id,
    position: row.position,
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

function toQuestionRow(input: CreateQuestionInput) {
  return {
    concept_id: input.conceptId,
    drill_id: input.drillId ?? null,
    position: input.position ?? null,
    type: input.type,
    prompt: input.prompt,
    options: input.options ?? null,
    correct_option_index: input.correctOptionIndex ?? null,
  };
}

export class SupabaseQuestionsRepository implements QuestionsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createQuestion(input: CreateQuestionInput): Promise<Question> {
    const { data, error } = await this.client
      .from("questions")
      .insert(toQuestionRow(input))
      .select()
      .single();
    if (error) throw error;
    return toQuestion(data as QuestionRow);
  }

  async createQuestions(inputs: CreateQuestionInput[]): Promise<Question[]> {
    if (inputs.length === 0) {
      return [];
    }
    // One multi-row insert, so a Drill's Questions are all written or none are.
    const { data, error } = await this.client
      .from("questions")
      .insert(inputs.map(toQuestionRow))
      .select();
    if (error) throw error;
    return (data as QuestionRow[]).map(toQuestion);
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

  async listDrillQuestions(drillId: string): Promise<Question[]> {
    const { data, error } = await this.client
      .from("questions")
      .select("*")
      .eq("drill_id", drillId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data as QuestionRow[]).map(toQuestion);
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

  async listAttemptsForQuestions(questionIds: string[]): Promise<Attempt[]> {
    if (questionIds.length === 0) {
      return [];
    }
    const { data, error } = await this.client
      .from("attempts")
      .select("*")
      .in("question_id", questionIds)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as AttemptRow[]).map(toAttempt);
  }
}
