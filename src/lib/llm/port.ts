import type { Correctness, QuestionType } from "@/lib/questions/types";

export type GeneratedQuestion =
  | { type: "recall"; prompt: string }
  | { type: "flashcard"; prompt: string; options: string[]; correctOptionIndex: number };

export type GradedAnswer = {
  correctness: Correctness;
  explanation: string;
};

export interface LlmPort {
  generateQuestion(input: {
    conceptName: string;
    conceptNotes: string | null;
    type: QuestionType;
  }): Promise<GeneratedQuestion>;

  gradeAnswer(input: { prompt: string; submittedAnswer: string }): Promise<GradedAnswer>;
}
