import Anthropic, { RateLimitError } from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AnthropicLlmPort, LLM_SETTINGS, type LlmSettings } from "./anthropic-port";

type Call = { endpoint: "standard" | "beta"; params: Record<string, unknown> };

/**
 * A stand-in for the Anthropic client that records each request and answers
 * with `output` as the parsed structured output. `failFast` makes fast-mode
 * requests fail with a 429, as they do when fast mode's own rate limit is hit.
 */
function fakeClient(output: unknown, { failFast = false } = {}) {
  const calls: Call[] = [];
  const parse = (endpoint: Call["endpoint"]) => async (params: Record<string, unknown>) => {
    calls.push({ endpoint, params });
    if (failFast && params.speed === "fast") {
      throw new RateLimitError(429, undefined, "Fast mode rate limit", new Headers());
    }
    return { parsed_output: output, usage: { input_tokens: 1, output_tokens: 1 } };
  };
  const client = { messages: { parse: parse("standard") }, beta: { messages: { parse: parse("beta") } } };
  return { client: client as unknown as Anthropic, calls };
}

const concept = { name: "Idempotency", notes: "Retrying has no extra effect." };
const graded = { correctness: "partial", explanation: "Missed retries.", referenceAnswer: "Same effect however often." };

function portWith(settings: Partial<LlmSettings>, output: unknown = { prompt: "Explain idempotency." }, options = {}) {
  const fake = fakeClient(output, options);
  return { port: new AnthropicLlmPort(fake.client, { ...LLM_SETTINGS, ...settings }), calls: fake.calls };
}

describe("AnthropicLlmPort", () => {
  it("by default writes recall and flashcard Questions and grades on Haiku, and scenarios on Sonnet at low effort", async () => {
    const fake = fakeClient({ prompt: "Q", options: ["A", "B"], correctOptionIndex: 0, ...graded });
    const port = new AnthropicLlmPort(fake.client);
    await port.generateQuestion({ type: "recall", concepts: [concept] });
    await port.generateQuestion({ type: "flashcard", concepts: [concept] });
    await port.generateQuestion({ type: "scenario", concepts: [concept, { name: "Retries", notes: null }] });
    await port.gradeAnswer({ question: { type: "recall", prompt: "Q" }, concepts: [concept], submittedAnswer: "A" });
    await port.gradeAnswer({ question: { type: "scenario", prompt: "Q" }, concepts: [concept], submittedAnswer: "A" });

    expect(fake.calls.map(({ endpoint }) => endpoint)).toEqual(Array(5).fill("standard"));
    expect(
      fake.calls.map(({ params }) => [params.model, (params.output_config as { effort?: string }).effort]),
    ).toEqual([
      ["claude-haiku-4-5", undefined],
      ["claude-haiku-4-5", undefined],
      ["claude-sonnet-5", "low"],
      ["claude-haiku-4-5", undefined],
      ["claude-haiku-4-5", undefined],
    ]);
  });

  it("leaves room for thinking in max_tokens where the model thinks", async () => {
    const { port, calls } = portWith({ writeRecall: { model: "claude-opus-5" } });
    await port.generateQuestion({ type: "recall", concepts: [concept] });
    expect(calls[0].params.max_tokens).toBeGreaterThanOrEqual(16000);
  });

  it("applies each call type's own model and effort", async () => {
    const { port, calls } = portWith({
      writeRecall: { model: "claude-sonnet-5", effort: "low" },
      writeScenario: { model: "claude-opus-5", effort: "high" },
    });
    await port.generateQuestion({ type: "recall", concepts: [concept] });
    await port.generateQuestion({ type: "scenario", concepts: [concept, { name: "Retries", notes: null }] });

    expect(calls.map(({ params }) => params.model)).toEqual(["claude-sonnet-5", "claude-opus-5"]);
    expect(calls.map(({ params }) => (params.output_config as { effort?: string }).effort)).toEqual(["low", "high"]);
  });

  it("sends Haiku no effort, which it doesn't accept", async () => {
    const { port, calls } = portWith({ writeFlashcard: { model: "claude-haiku-4-5" } }, {
      prompt: "Pick one.",
      options: ["A", "B"],
      correctOptionIndex: 0,
    });
    await port.generateQuestion({ type: "flashcard", concepts: [concept] });

    expect(calls[0].params.model).toBe("claude-haiku-4-5");
    expect(calls[0].params.output_config).not.toHaveProperty("effort");
    expect(calls[0].params).not.toHaveProperty("thinking");
  });

  it("sends fast mode through the beta endpoint with its beta flag", async () => {
    const { port, calls } = portWith({ gradeRecall: { model: "claude-opus-5", speed: "fast" } }, graded);
    const result = await port.gradeAnswer({
      question: { type: "recall", prompt: "Explain idempotency." },
      concepts: [concept],
      submittedAnswer: "You can call it twice.",
    });

    expect(result).toEqual(graded);
    expect(calls[0].endpoint).toBe("beta");
    expect(calls[0].params).toMatchObject({ speed: "fast", betas: ["fast-mode-2026-02-01"] });
  });

  it("falls back to standard speed when fast mode is rate limited", async () => {
    const { port, calls } = portWith(
      { gradeScenario: { model: "claude-opus-5", speed: "fast" } },
      graded,
      { failFast: true },
    );
    const result = await port.gradeAnswer({
      question: { type: "scenario", prompt: "Design a retry policy." },
      concepts: [concept],
      submittedAnswer: "Retry with backoff.",
    });

    expect(result).toEqual(graded);
    expect(calls.map(({ endpoint }) => endpoint)).toEqual(["beta", "standard"]);
    expect(calls[1].params).not.toHaveProperty("speed");
    expect(calls[1].params.model).toBe("claude-opus-5");
  });
});
