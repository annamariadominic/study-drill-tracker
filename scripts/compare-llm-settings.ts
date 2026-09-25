/**
 * Quality comparison for choosing model settings per call type (#20). Runs
 * the app's own LLM port, under each candidate setting, on a sample of real
 * material: studied Concepts to write recall, flashcard and scenario
 * Questions from, and past free-text Attempts to grade again. Writes a
 * side-by-side of every output with its latency and cost.
 *
 * It reads the database and never writes to it. It makes real API calls and
 * costs money: a few dollars for a full run.
 *
 * The report holds the learner's own notes and answers, so it's written to
 * the path given, or the system temp folder, never into the repo.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/compare-llm-settings.ts [report.md]
 */

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  AnthropicLlmPort,
  CALL_TYPES,
  type CallType,
  type LlmSettings,
  type ModelSettings,
} from "@/lib/llm/anthropic-port";
import type { QuestionConcept } from "@/lib/llm/port";
import { getQuestionsRepository } from "@/lib/questions/get-repository";
import type { FreeTextQuestionType } from "@/lib/questions/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import type { StudiedConcept } from "@/lib/syllabus/types";

const CANDIDATES: { label: string; settings: ModelSettings }[] = [
  { label: "Opus 5, default (before #20)", settings: { model: "claude-opus-5" } },
  { label: "Opus 5, effort low", settings: { model: "claude-opus-5", effort: "low" } },
  { label: "Opus 5, fast mode", settings: { model: "claude-opus-5", speed: "fast" } },
  { label: "Sonnet 5, effort low", settings: { model: "claude-sonnet-5", effort: "low" } },
  { label: "Haiku 4.5", settings: { model: "claude-haiku-4-5" } },
];

/** $ per million tokens, input and output (thinking bills as output). */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-5 fast": { input: 10, output: 50 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const SAMPLE = { recall: 3, flashcard: 2, scenario: 2, recallAttempts: 3, scenarioAttempts: 2 };

type Usage = { input_tokens: number; output_tokens: number; speed?: string | null };
type Run = { ms: number; cost: number; outputTokens: number; speed: string; output: string };

/** The Anthropic client, wrapped to note the usage of each response the port gets back. */
function recordingClient(model: string) {
  const record: { usage?: Usage } = {};
  const client = new Anthropic();
  const wrap = <T extends { parse: (...args: never[]) => Promise<unknown> }>(messages: T) => {
    const parse = messages.parse.bind(messages);
    messages.parse = (async (...args: Parameters<T["parse"]>) => {
      const response = (await parse(...args)) as { usage: Usage };
      record.usage = response.usage;
      return response;
    }) as T["parse"];
  };
  wrap(client.messages);
  wrap(client.beta.messages);
  const costOf = (usage: Usage) => {
    const price = PRICES[usage.speed === "fast" ? `${model} fast` : model];
    return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000;
  };
  return { client, record, costOf };
}

type Case = { callType: CallType; title: string; input: string; run: (port: AnthropicLlmPort) => Promise<string> };

function describe(concepts: QuestionConcept[]) {
  return concepts.map(({ name, notes }) => (notes ? `**${name}**: ${notes}` : `**${name}**`)).join("<br>");
}

function asConcept({ concept }: StudiedConcept): QuestionConcept {
  return { name: concept.name, notes: concept.notes };
}

/** Pairs of studied Concepts from one Domain, preferring different Subjects, as a Drill's scenario would. */
function scenarioPairs(studied: StudiedConcept[], count: number) {
  const pairs: StudiedConcept[][] = [];
  const used = new Set<string>();
  for (const first of studied) {
    const second = studied.find(
      (other) =>
        other.domain.id === first.domain.id &&
        other.subject.id !== first.subject.id &&
        !used.has(other.concept.id) &&
        !used.has(first.concept.id),
    );
    if (second) {
      pairs.push([first, second]);
      used.add(first.concept.id).add(second.concept.id);
    }
    if (pairs.length === count) break;
  }
  return pairs;
}

async function pastAttempts(type: FreeTextQuestionType, count: number) {
  const { data, error } = await getSupabaseClient()
    .from("attempts")
    .select("submitted_answer, correctness, graded_explanation, reference_answer, question_id, questions!inner(type)")
    .eq("questions.type", type)
    // Only Attempts with a grade to compare against (ADR 0011).
    .eq("grading_status", "graded")
    .order("created_at", { ascending: false })
    .limit(count);
  if (error) throw error;
  const questionsRepo = getQuestionsRepository();
  const syllabusRepo = getSyllabusRepository();
  return Promise.all(
    (data ?? []).map(async (row) => {
      const question = (await questionsRepo.getQuestion(row.question_id))!;
      const concepts = await Promise.all(question.conceptIds.map((id) => syllabusRepo.getConcept(id)));
      return {
        prompt: question.prompt,
        answer: row.submitted_answer as string,
        original: `${row.correctness}: ${row.graded_explanation}`,
        concepts: concepts.flatMap((c) => (c ? [{ name: c.name, notes: c.notes }] : [])),
      };
    }),
  );
}

async function buildCases(): Promise<Case[]> {
  const studied = await getSyllabusRepository().listStudiedConcepts();
  // Concepts with notes first: they're what the questions and grades should draw on.
  const byNotes = [...studied].sort((a, b) => (b.concept.notes?.length ?? 0) - (a.concept.notes?.length ?? 0));
  const cases: Case[] = [];

  for (const one of byNotes.slice(0, SAMPLE.recall)) {
    cases.push({
      callType: "writeRecall",
      title: `Write recall: ${one.concept.name}`,
      input: describe([asConcept(one)]),
      run: async (port) => (await port.generateQuestion({ type: "recall", concepts: [asConcept(one)] })).prompt,
    });
  }
  for (const one of byNotes.slice(SAMPLE.recall, SAMPLE.recall + SAMPLE.flashcard)) {
    cases.push({
      callType: "writeFlashcard",
      title: `Write flashcard: ${one.concept.name}`,
      input: describe([asConcept(one)]),
      run: async (port) => {
        const q = await port.generateQuestion({ type: "flashcard", concepts: [asConcept(one)] });
        if (q.type !== "flashcard") return q.prompt;
        return `${q.prompt}<br>${q.options.map((o, i) => `${i === q.correctOptionIndex ? "✔" : "·"} ${o}`).join("<br>")}`;
      },
    });
  }
  for (const pair of scenarioPairs(byNotes, SAMPLE.scenario)) {
    const concepts = pair.map(asConcept);
    cases.push({
      callType: "writeScenario",
      title: `Write scenario: ${concepts.map((c) => c.name).join(" + ")}`,
      input: describe(concepts),
      run: async (port) => (await port.generateQuestion({ type: "scenario", concepts })).prompt,
    });
  }
  const attempts = [
    ...(await pastAttempts("recall", SAMPLE.recallAttempts)).map((a) => ({ ...a, type: "recall" as const })),
    ...(await pastAttempts("scenario", SAMPLE.scenarioAttempts)).map((a) => ({ ...a, type: "scenario" as const })),
  ];
  for (const attempt of attempts) {
    cases.push({
      callType: attempt.type === "recall" ? "gradeRecall" : "gradeScenario",
      title: `Grade ${attempt.type}: ${attempt.prompt.slice(0, 70)}${attempt.prompt.length > 70 ? "…" : ""}`,
      input: `**Question:** ${attempt.prompt}<br>**Answer:** ${attempt.answer}<br>**Graded at the time:** ${attempt.original}`,
      run: async (port) => {
        const g = await port.gradeAnswer({
          question: { type: attempt.type, prompt: attempt.prompt },
          concepts: attempt.concepts,
          submittedAnswer: attempt.answer,
        });
        return `**${g.correctness}**: ${g.explanation}<br>*Strong answer:* ${g.referenceAnswer}`;
      },
    });
  }
  return cases;
}

async function runCandidate(settings: ModelSettings, cases: Case[]): Promise<Run[]> {
  const { client, record, costOf } = recordingClient(settings.model);
  const all = Object.fromEntries(CALL_TYPES.map((callType) => [callType, settings])) as LlmSettings;
  const port = new AnthropicLlmPort(client, all);
  const runs: Run[] = [];
  for (const one of cases) {
    record.usage = undefined;
    const start = performance.now();
    let output: string;
    try {
      output = await one.run(port);
    } catch (error) {
      output = `⚠ failed: ${(error as Error).message.slice(0, 120)}`;
    }
    const usage = record.usage as Usage | undefined;
    runs.push({
      ms: performance.now() - start,
      cost: usage ? costOf(usage) : 0,
      outputTokens: usage?.output_tokens ?? 0,
      speed: usage?.speed ?? "standard",
      output,
    });
  }
  return runs;
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n+/g, "<br>");

async function main() {
  // Never the repo by default: the report quotes the learner's notes and answers.
  const reportPath = process.argv[2] ?? join(tmpdir(), "llm-settings-comparison.md");
  const cases = await buildCases();
  console.log(`${cases.length} cases × ${CANDIDATES.length} settings`);
  const results = await Promise.all(CANDIDATES.map(({ settings }) => runCandidate(settings, cases)));

  const lines: string[] = ["# LLM settings comparison (#20)", "", `Generated ${new Date().toISOString()}.`, ""];

  lines.push("## Latency and cost by call type", "", "Median latency per call, and total cost of the sample.", "");
  lines.push(`| Call type | ${CANDIDATES.map((c) => c.label).join(" | ")} |`, `|---|${CANDIDATES.map(() => "---").join("|")}|`);
  for (const callType of [...new Set(cases.map((c) => c.callType))]) {
    const indexes = cases.flatMap((c, i) => (c.callType === callType ? [i] : []));
    const cells = results.map((runs) => {
      const ms = indexes.map((i) => runs[i].ms).sort((a, b) => a - b);
      const cost = indexes.reduce((sum, i) => sum + runs[i].cost, 0);
      return `${(ms[Math.floor(ms.length / 2)] / 1000).toFixed(1)} s, $${cost.toFixed(4)}`;
    });
    lines.push(`| ${callType} (${indexes.length}) | ${cells.join(" | ")} |`);
  }
  const totals = results.map((runs) => `$${runs.reduce((sum, r) => sum + r.cost, 0).toFixed(3)}`);
  lines.push(`| **Total cost** | ${totals.join(" | ")} |`, "");
  const fastFellBack = results[CANDIDATES.findIndex((c) => "speed" in c.settings)]?.filter((r) => r.speed !== "fast").length;
  if (fastFellBack) lines.push(`Fast mode fell back to standard speed on ${fastFellBack} call(s).`, "");

  lines.push("## Outputs side by side", "");
  cases.forEach((one, i) => {
    lines.push(`### ${one.title}`, "", one.input, "", "| Setting | Output | Time | Cost |", "|---|---|---|---|");
    CANDIDATES.forEach((candidate, c) => {
      const run = results[c][i];
      lines.push(`| ${candidate.label} | ${cell(run.output)} | ${(run.ms / 1000).toFixed(1)} s | $${run.cost.toFixed(4)} |`);
    });
    lines.push("");
  });

  writeFileSync(reportPath, lines.join("\n"));
  console.log(lines.slice(0, lines.indexOf("## Outputs side by side")).join("\n"));
  console.log(`\nFull side-by-side written to ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
