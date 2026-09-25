import { APIConnectionError, APIError, RateLimitError, type default as Anthropic } from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
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

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * The model to call and how. Only what each model accepts can be set: Haiku
 * 4.5 takes no effort, and fast mode is Opus 5 only (a research preview on the
 * Claude API, at twice the per-token price). Opus 5 and Sonnet 5 think
 * adaptively; effort defaults to "high".
 */
export type ModelSettings =
  | { model: "claude-opus-5"; effort?: Effort; speed?: "fast" }
  | { model: "claude-sonnet-5"; effort?: Effort }
  | { model: "claude-haiku-4-5" };

/** Each kind of call the port makes, so each can trade speed and cost against quality on its own. */
export const CALL_TYPES = ["writeRecall", "writeFlashcard", "writeScenario", "gradeRecall", "gradeScenario"] as const;

export type CallType = (typeof CALL_TYPES)[number];

export type LlmSettings = Record<CallType, ModelSettings>;

/**
 * The settings the learner chose from a side-by-side on their own material
 * (ADR 0010): Haiku 4.5 wherever it held up, which it did for recall and
 * flashcard Questions and for grading, and Sonnet 5 at low effort for
 * scenarios, which need more reasoning to write.
 */
export const LLM_SETTINGS: LlmSettings = {
  writeRecall: { model: "claude-haiku-4-5" },
  writeFlashcard: { model: "claude-haiku-4-5" },
  writeScenario: { model: "claude-sonnet-5", effort: "low" },
  gradeRecall: { model: "claude-haiku-4-5" },
  gradeScenario: { model: "claude-haiku-4-5" },
};

const FAST_MODE_BETA = "fast-mode-2026-02-01";

/**
 * Failures worth retrying. The fast-mode request doesn't retry them itself:
 * a 429 there means fast mode's own limit, and for the rest standard speed
 * is as good a retry as the same request again.
 */
function isRetryable(error: unknown) {
  return (
    error instanceof RateLimitError ||
    error instanceof APIConnectionError ||
    (error instanceof APIError && typeof error.status === "number" && error.status >= 500)
  );
}

/** Room for adaptive thinking as well as the answer; Haiku 4.5 doesn't think unless asked. */
function maxTokens(settings: ModelSettings) {
  return settings.model === "claude-haiku-4-5" ? 4096 : 16000;
}

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
  constructor(
    private readonly client: Anthropic,
    private readonly settings: LlmSettings = LLM_SETTINGS,
  ) {}

  async generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestion> {
    const content = describeConcepts(input.concepts);

    if (input.type === "scenario") {
      const { prompt } = await this.parse("writeScenario", {
        system:
          "You write a single realistic applied scenario question that can only be answered well by reasoning about all of the given concepts together. Describe a concrete situation or problem and ask the learner how they would approach it, without naming or giving away the answer.",
        content,
        schema: PromptOnlySchema,
        what: "generate scenario question",
      });
      return { type: "scenario", prompt };
    }

    if (input.type === "recall") {
      const { prompt } = await this.parse("writeRecall", {
        system:
          "You write a single concise active-recall study question for a given concept. The question should prompt the learner to explain or apply the concept from memory, without giving away the answer.",
        content,
        schema: PromptOnlySchema,
        what: "generate recall question",
      });
      return { type: "recall", prompt };
    }

    const flashcard = await this.parse("writeFlashcard", {
      system:
        "You write a single multiple-choice flashcard question for a given concept, with 3-4 plausible options. Exactly one option is correct. correctOptionIndex is the zero-based index of the correct option in the options array.",
      content,
      schema: FlashcardQuestionSchema,
      what: "generate flashcard question",
    });
    return { type: "flashcard", ...flashcard };
  }

  async gradeAnswer(input: GradeAnswerInput): Promise<GradedAnswer> {
    const scenario = input.question.type === "scenario";
    return this.parse(scenario ? "gradeScenario" : "gradeRecall", {
      system: scenario ? `${GRADING_SYSTEM_PROMPT}\n\n${SCENARIO_GRADING_GUIDANCE}` : GRADING_SYSTEM_PROMPT,
      content: [
        `Question: ${input.question.prompt}`,
        describeConcepts(input.concepts),
        `Learner's answer: ${input.submittedAnswer}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      schema: GradedAnswerSchema,
      what: "grade answer",
    });
  }

  /**
   * One structured-output request, sent with the call type's settings. When a
   * fast-mode request hits fast mode's own rate limit, or fails in any other
   * way worth retrying, the same request goes again at standard speed.
   */
  private async parse<T>(
    callType: CallType,
    request: { system: string; content: string; schema: z.ZodType<T>; what: string },
  ): Promise<T> {
    const settings = this.settings[callType];
    const base = {
      model: settings.model,
      max_tokens: maxTokens(settings),
      system: request.system,
      messages: [{ role: "user" as const, content: request.content }],
    };
    const effort = "effort" in settings && settings.effort ? { effort: settings.effort } : {};

    if ("speed" in settings && settings.speed === "fast") {
      try {
        const response = await this.client.beta.messages.parse(
          {
            ...base,
            speed: "fast",
            betas: [FAST_MODE_BETA],
            output_config: { ...effort, format: betaZodOutputFormat(request.schema) },
          },
          { maxRetries: 0 },
        );
        return parsedOrThrow(response.parsed_output as T | null, request.what);
      } catch (error) {
        if (!isRetryable(error)) {
          throw error;
        }
      }
    }

    const response = await this.client.messages.parse({
      ...base,
      output_config: { ...effort, format: zodOutputFormat(request.schema) },
    });
    return parsedOrThrow(response.parsed_output as T | null, request.what);
  }
}

function parsedOrThrow<T>(output: T | null | undefined, what: string): T {
  if (output == null) {
    throw new Error(`Failed to ${what}: no parsed output`);
  }
  return output;
}
