import type { SupabaseClient } from "@supabase/supabase-js";
import { assertQuestionConcepts } from "./concepts";
import type { CreateAttemptInput, CreateQuestionInput, QuestionsRepository } from "./repository";
import type { Attempt, Confidence, Correctness, Question, QuestionType } from "./types";

type QuestionRow = {
  id: string;
  drill_id: string | null;
  position: number | null;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  correct_option_index: number | null;
  created_at: string;
};

type QuestionConceptRow = { concept_id: string; position: number };

/** A Question row read back with its Concept links embedded. */
type QuestionWithConceptsRow = QuestionRow & { question_concepts: QuestionConceptRow[] };

const QUESTION_WITH_CONCEPTS = "*, question_concepts(concept_id, position)";

type AttemptRow = {
  id: string;
  question_id: string;
  submitted_answer: string;
  confidence: Confidence;
  correctness: Correctness;
  graded_explanation: string;
  reference_answer: string | null;
  created_at: string;
};

function toQuestion(row: QuestionRow, conceptIds: string[]): Question {
  return {
    id: row.id,
    conceptIds,
    drillId: row.drill_id,
    position: row.position,
    type: row.type,
    prompt: row.prompt,
    options: row.options,
    correctOptionIndex: row.correct_option_index,
    createdAt: row.created_at,
  };
}

/**
 * Rejects a Question whose Concept links no longer fit its type, rather than
 * handing a malformed Question to the rest of the app.
 */
function toQuestionWithConcepts(row: QuestionWithConceptsRow): Question {
  const conceptIds = [...row.question_concepts]
    .sort((a, b) => a.position - b.position)
    .map((link) => link.concept_id);
  assertQuestionConcepts({ id: row.id, type: row.type, conceptIds });
  return toQuestion(row, conceptIds);
}

function toAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    questionId: row.question_id,
    submittedAnswer: row.submitted_answer,
    confidence: row.confidence,
    correctness: row.correctness,
    gradedExplanation: row.graded_explanation,
    referenceAnswer: row.reference_answer,
    createdAt: row.created_at,
  };
}

/** The shape the create_questions database function takes for each Question. */
function toCreateQuestionsArg(input: CreateQuestionInput) {
  return {
    concept_ids: input.conceptIds,
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
    const [question] = await this.createQuestions([input]);
    return question;
  }

  async createQuestions(inputs: CreateQuestionInput[]): Promise<Question[]> {
    if (inputs.length === 0) {
      return [];
    }
    inputs.forEach(assertQuestionConcepts);
    // One database function call inserts the Questions and their Concept links
    // in a single transaction, so a Drill's Questions are all written or none are.
    const { data, error } = await this.client.rpc("create_questions", {
      inputs: inputs.map(toCreateQuestionsArg),
    });
    if (error) throw error;
    // Rows come back in input order, so each lines up with the Concepts it was given.
    return (data as QuestionRow[]).map((row, index) => toQuestion(row, [...inputs[index].conceptIds]));
  }

  async getQuestion(id: string): Promise<Question | null> {
    const { data, error } = await this.client
      .from("questions")
      .select(QUESTION_WITH_CONCEPTS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toQuestionWithConcepts(data as QuestionWithConceptsRow) : null;
  }

  async listDrillQuestions(drillId: string): Promise<Question[]> {
    const { data, error } = await this.client
      .from("questions")
      .select(QUESTION_WITH_CONCEPTS)
      .eq("drill_id", drillId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data as QuestionWithConceptsRow[]).map(toQuestionWithConcepts);
  }

  async createAttempt(input: CreateAttemptInput): Promise<Attempt> {
    const { data, error } = await this.client
      .from("attempts")
      .insert({
        question_id: input.questionId,
        submitted_answer: input.submittedAnswer,
        confidence: input.confidence,
        correctness: input.correctness,
        graded_explanation: input.gradedExplanation,
        reference_answer: input.referenceAnswer ?? null,
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

  async listDrillAttempts(drillId: string): Promise<Attempt[]> {
    // The inner join filters on the Question's Drill in the same request.
    const { data, error } = await this.client
      .from("attempts")
      .select("*, questions!inner(drill_id)")
      .eq("questions.drill_id", drillId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as AttemptRow[]).map(toAttempt);
  }
}
