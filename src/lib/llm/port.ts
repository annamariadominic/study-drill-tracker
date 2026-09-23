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

/**
 * What to write one Question about: a single Concept for recall or flashcard,
 * or every Concept a scenario combines.
 */
export type GenerateQuestionInput = {
  concepts: QuestionConcept[];
  type: QuestionType;
};

export interface LlmPort {
  generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestion>;

  gradeAnswer(input: { prompt: string; submittedAnswer: string }): Promise<GradedAnswer>;
}
