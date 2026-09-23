import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type {
  GenerateQuestionInput,
  GeneratedQuestion,
  GradedAnswer,
  LlmPort,
  QuestionConcept,
} from "./port";

const MODEL = "claude-opus-5";

const PromptOnlySchema = z.object({
  prompt: z.string(),
});

const FlashcardQuestionSchema = z
  .object({
    prompt: z.string(),
    options: z.array(z.string()).min(2).max(6),
    correctOptionIndex: z.number().int().min(0),
  })
  .refine((value) => value.correctOptionIndex < value.options.length, {
    message: "correctOptionIndex must be a valid index into options",
    path: ["correctOptionIndex"],
  });

const GradedAnswerSchema = z.object({
  correctness: z.enum(["correct", "partial", "incorrect"]),
  explanation: z.string(),
});

function describeConcept(concept: QuestionConcept): string {
  return concept.notes
    ? `Concept: ${concept.name}\nNotes: ${concept.notes}`
    : `Concept: ${concept.name}`;
}

function describeConcepts(concepts: QuestionConcept[]): string {
  return concepts.map(describeConcept).join("\n\n");
}

export class AnthropicLlmPort implements LlmPort {
  constructor(private readonly client: Anthropic) {}

  async generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestion> {
    if (input.type === "scenario") {
      const response = await this.client.messages.parse({
        model: MODEL,
        max_tokens: 1024,
        system:
          "You write a single realistic applied scenario question that can only be answered well by reasoning about all of the given concepts together. Describe a concrete situation or problem and ask the learner how they would approach it, without naming or giving away the answer.",
        messages: [{ role: "user", content: describeConcepts(input.concepts) }],
        output_config: { format: zodOutputFormat(PromptOnlySchema) },
      });
      if (!response.parsed_output) {
        throw new Error("Failed to generate scenario question: no parsed output");
      }
      return { type: "scenario", prompt: response.parsed_output.prompt };
    }

    if (input.type === "recall") {
      const response = await this.client.messages.parse({
        model: MODEL,
        max_tokens: 1024,
        system:
          "You write a single concise active-recall study question for a given concept. The question should prompt the learner to explain or apply the concept from memory, without giving away the answer.",
        messages: [{ role: "user", content: describeConcepts(input.concepts) }],
        output_config: { format: zodOutputFormat(PromptOnlySchema) },
      });
      if (!response.parsed_output) {
        throw new Error("Failed to generate recall question: no parsed output");
      }
      return { type: "recall", prompt: response.parsed_output.prompt };
    }

    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You write a single multiple-choice flashcard question for a given concept, with 3-4 plausible options. Exactly one option is correct. correctOptionIndex is the zero-based index of the correct option in the options array.",
      messages: [{ role: "user", content: describeConcepts(input.concepts) }],
      output_config: { format: zodOutputFormat(FlashcardQuestionSchema) },
    });
    if (!response.parsed_output) {
      throw new Error("Failed to generate flashcard question: no parsed output");
    }
    return { type: "flashcard", ...response.parsed_output };
  }

  async gradeAnswer(input: { prompt: string; submittedAnswer: string }): Promise<GradedAnswer> {
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system:
        "You grade a learner's free-text answer to a study question on a three-way scale: 'correct', 'partial', or 'incorrect'. Give a short explanation of the grade.",
      messages: [
        {
          role: "user",
          content: `Question: ${input.prompt}\n\nLearner's answer: ${input.submittedAnswer}`,
        },
      ],
      output_config: { format: zodOutputFormat(GradedAnswerSchema) },
    });
    if (!response.parsed_output) {
      throw new Error("Failed to grade answer: no parsed output");
    }
    return response.parsed_output;
  }
}
