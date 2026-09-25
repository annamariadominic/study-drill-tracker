/**
 * LLM latency benchmark for the two calls users wait on: writing a Question
 * (up to ten run in parallel to start a Drill) and grading a free-text
 * answer. Compares the app's current settings with cheaper and faster ones,
 * reporting wall time, output tokens (thinking included) and whether the
 * structured output parsed.
 *
 * This makes real API calls and costs money (well under $1 per full run).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/measure-llm-latency.ts
 *
 * The prompts are copied from src/lib/llm/anthropic-port.ts so the benchmark
 * can vary model and effort without changing the app; keep them in step if
 * those prompts change.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const RECALL_SYSTEM =
  "You write a single concise active-recall study question for a given concept. The question should prompt the learner to explain or apply the concept from memory, without giving away the answer.";

const GRADING_SYSTEM = `You grade a learner's free-text answer to a study question on a three-way scale: 'correct', 'partial', or 'incorrect'.

You are given the question, the concepts it was written from (with the learner's own notes where they have them), and the learner's answer.

Return:
- correctness: the grade.
- explanation: a short explanation of why the answer earned that grade, naming anything important that was missing or wrong.
- referenceAnswer: what a strong answer to this exact question would say, written for the learner to study from. It must directly answer the question and cover the key points, especially any the learner missed. Keep it concise: a few sentences or a short list, not an essay. Always write it, whatever the grade.

Grade the answer against the question that was asked. Use the concepts and notes to ground the reference answer in the learner's material, but don't mark the learner down for leaving out details of the notes the question didn't ask for.`;

const CONCEPT = "Concept: idempotency\nNotes: Retrying a request has no additional effect beyond the first.";

const GRADING_INPUT = [
  "Question: Explain what makes an API operation idempotent and why it matters when clients retry requests.",
  CONCEPT,
  "Learner's answer: It means you can call it more than once. It matters because networks fail.",
].join("\n\n");

const PromptOnly = z.object({ prompt: z.string() });
const Graded = z.object({
  correctness: z.enum(["correct", "partial", "incorrect"]),
  explanation: z.string(),
  referenceAnswer: z.string(),
});

type Config = {
  label: string;
  model: string;
  /** Extra request fields: thinking and effort settings. */
  extra: Record<string, unknown>;
  genMaxTokens: number;
  gradeMaxTokens: number;
};

const CONFIGS: Config[] = [
  // What the app sends today: no thinking or effort set, so Opus 5 runs adaptive thinking at effort "high".
  { label: "current: opus-5, default (adaptive, high)", model: "claude-opus-5", extra: {}, genMaxTokens: 1024, gradeMaxTokens: 2048 },
  { label: "opus-5, effort low", model: "claude-opus-5", extra: { output_config: { effort: "low" } }, genMaxTokens: 16000, gradeMaxTokens: 16000 },
  { label: "sonnet-5, effort low", model: "claude-sonnet-5", extra: { output_config: { effort: "low" } }, genMaxTokens: 16000, gradeMaxTokens: 16000 },
  { label: "haiku-4-5 (no thinking)", model: "claude-haiku-4-5", extra: {}, genMaxTokens: 4096, gradeMaxTokens: 4096 },
];

const client = new Anthropic();

type Result = { ms: number; outputTokens: number; stopReason: string | null; parsed: boolean };

async function timed(run: () => Promise<Anthropic.Messages.Message & { parsed_output?: unknown }>): Promise<Result> {
  const start = performance.now();
  try {
    const response = await run();
    return {
      ms: performance.now() - start,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
      parsed: response.parsed_output != null,
    };
  } catch (error) {
    // A reply cut off by max_tokens fails to parse; count it rather than abort the run.
    return { ms: performance.now() - start, outputTokens: 0, stopReason: `error: ${(error as Error).message.slice(0, 60)}`, parsed: false };
  }
}

function generate(config: Config) {
  return timed(() =>
    client.messages.parse({
      model: config.model,
      max_tokens: config.genMaxTokens,
      system: RECALL_SYSTEM,
      messages: [{ role: "user", content: CONCEPT }],
      ...config.extra,
      output_config: { ...(config.extra.output_config as object), format: zodOutputFormat(PromptOnly) },
    } as Parameters<typeof client.messages.parse>[0]),
  );
}

function grade(config: Config) {
  return timed(() =>
    client.messages.parse({
      model: config.model,
      max_tokens: config.gradeMaxTokens,
      system: GRADING_SYSTEM,
      messages: [{ role: "user", content: GRADING_INPUT }],
      ...config.extra,
      output_config: { ...(config.extra.output_config as object), format: zodOutputFormat(Graded) },
    } as Parameters<typeof client.messages.parse>[0]),
  );
}

function summarize(label: string, results: Result[]) {
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const tokens = results.map((r) => r.outputTokens);
  const failures = results.filter((r) => !r.parsed);
  console.log(
    `  ${label.padEnd(26)} median ${Math.round(ms[Math.floor(ms.length / 2)]).toString().padStart(6)} ms  max ${Math.round(ms[ms.length - 1]).toString().padStart(6)} ms  output tokens ${Math.min(...tokens)}–${Math.max(...tokens)}  parse failures ${failures.length}/${results.length}${failures.length ? ` (${[...new Set(failures.map((f) => f.stopReason))].join(", ")})` : ""}`,
  );
}

async function main() {
  for (const config of CONFIGS) {
    console.log(`\n${config.label}`);
    const singles: Result[] = [];
    for (let i = 0; i < 3; i++) singles.push(await generate(config));
    summarize("write 1 Question", singles);

    // Starting a Drill writes up to ten Questions at once; the user waits for the slowest.
    const start = performance.now();
    const batch = await Promise.all(Array.from({ length: 10 }, () => generate(config)));
    summarize("write 10 in parallel", batch);
    console.log(`  ${"  → Drill waits".padEnd(26)} ${Math.round(performance.now() - start)} ms for all ten`);

    const grades: Result[] = [];
    for (let i = 0; i < 3; i++) grades.push(await grade(config));
    summarize("grade 1 answer", grades);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
