import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type {
  GenerateQuestionInput,
  GeneratedQuestion,
  GradeAnswerInput,
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
  referenceAnswer: z.string(),
});

const GRADING_SYSTEM_PROMPT = `You grade a learner's free-text answer to a study question on a three-way scale: 'correct', 'partial', or 'incorrect'.

You are given the question, the concepts it was written from (with the learner's own notes where they have them), and the learner's answer.

Return:
- correctness: the grade.
- explanation: a short explanation of why the answer earned that grade, naming anything important that was missing or wrong.
- referenceAnswer: what a strong answer to this exact question would say, written for the learner to study from. It must directly answer the question and cover the key points, especially any the learner missed. Keep it concise: a few sentences or a short list, not an essay. Always write it, whatever the grade.

Grade the answer against the question that was asked. Use the concepts and notes to ground the reference answer in the learner's material, but don't mark the learner down for leaving out details of the notes the question didn't ask for.`;

const SCENARIO_GRADING_GUIDANCE = `This is an open-ended scenario question, so there is rarely one exact right answer. Grade the quality of the learner's reasoning, and for the referenceAnswer outline a strong approach: the key considerations, how the concepts apply together, and the main trade-offs.`;

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

  async gradeAnswer(input: GradeAnswerInput): Promise<GradedAnswer> {
    const system =
      input.question.type === "scenario"
        ? `${GRADING_SYSTEM_PROMPT}\n\n${SCENARIO_GRADING_GUIDANCE}`
        : GRADING_SYSTEM_PROMPT;
    const response = await this.client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: [
        {
          role: "user",
          content: [
            `Question: ${input.question.prompt}`,
            describeConcepts(input.concepts),
            `Learner's answer: ${input.submittedAnswer}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
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
