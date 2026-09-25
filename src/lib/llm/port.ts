import type { Correctness, FreeTextQuestionType, QuestionType } from "@/lib/questions/types";

export type GeneratedQuestion =
  | { type: "recall"; prompt: string }
  | { type: "flashcard"; prompt: string; options: string[]; correctOptionIndex: number }
  | { type: "scenario"; prompt: string };

export type GradedAnswer = {
  correctness: Correctness;
  /** Why the answer earned its grade. */
  explanation: string;
  /**
   * What a strong answer would have said, stated on its own so the learner
   * always has something to study from, whatever the grade.
   */
  referenceAnswer: string;
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

/**
 * A free-text answer to grade, with the Concepts its Question was written
 * from so the reference answer is grounded in the learner's own material.
 */
export type GradeAnswerInput = {
  question: { type: FreeTextQuestionType; prompt: string };
  concepts: QuestionConcept[];
  submittedAnswer: string;
};

export interface LlmPort {
  generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestion>;

  gradeAnswer(input: GradeAnswerInput): Promise<GradedAnswer>;
}
