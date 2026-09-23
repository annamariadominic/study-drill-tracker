import type { Correctness, QuestionType } from "@/lib/questions/types";

export type GeneratedQuestion =
  | { type: "recall"; prompt: string }
  | { type: "flashcard"; prompt: string; options: string[]; correctOptionIndex: number }
  | { type: "scenario"; prompt: string };

export type GradedAnswer = {
  correctness: Correctness;
  explanation: string;
};

/** A Concept as the LLM sees it when writing a Question. */
export type QuestionConcept = {
  name: string;
  notes: string | null;
};

export interface LlmPort {
  /**
   * Writes one Question: a recall or flashcard Question about a single
   * Concept, or a scenario prompt that combines every Concept given.
   */
  generateQuestion(input: {
    concepts: QuestionConcept[];
    type: QuestionType;
  }): Promise<GeneratedQuestion>;

  gradeAnswer(input: { prompt: string; submittedAnswer: string }): Promise<GradedAnswer>;
}
