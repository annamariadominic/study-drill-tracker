import type { GeneratedQuestion } from "@/lib/llm/port";
import type { QuestionType } from "./types";

/**
 * The Question fields carried by LLM-generated content. The flashcard-only
 * fields are null for a recall Question.
 */
export function questionFieldsFromGenerated(generated: GeneratedQuestion): {
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  correctOptionIndex: number | null;
} {
  return {
    type: generated.type,
    prompt: generated.prompt,
    options: generated.type === "flashcard" ? generated.options : null,
    correctOptionIndex: generated.type === "flashcard" ? generated.correctOptionIndex : null,
  };
}
