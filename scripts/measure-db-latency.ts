/**
 * Read-only latency probe: runs the database reads behind the slow
 * interactions (starting a due Drill, loading the Drill page, submitting an
 * answer) and reports, for each, how many Supabase requests it makes, how
 * many of them happen one after another ("waves"), and the wall-clock time.
 *
 * It never writes. The writes on those paths (create Drill, create Questions,
 * create Attempt, update schedule) are each one more round trip on top.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/measure-db-latency.ts
 *
 * Numbers are from wherever this runs, not from Vercel. From the US east
 * coast they approximate the deployed app, whose functions run in iad1 while
 * the database is in us-west-2.
 */

import { loadDrill, drillConceptNames } from "@/lib/drills/load-drill";
import { getDrillsRepository } from "@/lib/drills/get-repository";
import { getQuestionsRepository } from "@/lib/questions/get-repository";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import { listDueConcepts } from "@/lib/syllabus/list-due-concepts";

type Span = { start: number; end: number };
let spans: Span[] = [];

// supabase-js calls the global fetch at request time, so wrapping it here
// sees every database request.
const realFetch = globalThis.fetch;
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
  const span = { start: performance.now(), end: 0 };
  try {
    return await realFetch(...args);
  } finally {
    span.end = performance.now();
    spans.push(span);
  }
};

/** Requests that had to wait for an earlier one: the length of the longest chain of non-overlapping requests. */
function waves(recorded: Span[]): number {
  const sorted = [...recorded].sort((a, b) => a.start - b.start);
  let count = 0;
  let frontier = -Infinity;
  for (const span of sorted) {
    if (span.start >= frontier) {
      count++;
      frontier = span.end;
    } else {
      frontier = Math.min(frontier, span.end);
    }
  }
  return count;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function measure(label: string, run: () => Promise<unknown>) {
  const times: number[] = [];
  let requests = 0;
  let sequential = 0;
  for (let i = 0; i < 3; i++) {
    spans = [];
    const start = performance.now();
    await run();
    times.push(performance.now() - start);
    requests = spans.length;
    sequential = waves(spans);
  }
  console.log(
    `${label.padEnd(44)} ${String(requests).padStart(3)} requests  ${String(sequential).padStart(2)} sequential  ${Math.round(median(times))
      .toString()
      .padStart(5)} ms (median of 3)`,
  );
}

async function main() {
  const syllabusRepo = getSyllabusRepository();
  const drillsRepo = getDrillsRepository();
  const questionsRepo = getQuestionsRepository();

  // Warm the connection so the first measurement isn't paying for TLS.
  await syllabusRepo.listDomains();

  const rtts: number[] = [];
  for (let i = 0; i < 7; i++) {
    const start = performance.now();
    await syllabusRepo.listDomains();
    rtts.push(performance.now() - start);
  }
  console.log(`One small query (list Domains), warm:          median ${Math.round(median(rtts))} ms\n`);

  const domains = await syllabusRepo.listDomains();
  const subjectCounts = await Promise.all(domains.map((d) => syllabusRepo.listSubjects(d.id)));
  console.log(
    `Library: ${domains.length} Domains, ${subjectCounts.flat().length} Subjects\n`,
  );

  // The most recent Drill and one of its Questions, to replay the Drill-page and answer-submission reads.
  const { data: latest, error } = await getSupabaseClient()
    .from("drills")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  await measure("Start due Drill: read due Concepts", async () => {
    if (domains[0]) await syllabusRepo.getDomain(domains[0].id);
    await listDueConcepts(syllabusRepo);
  });
  await measure("Study / Random Drill page: studied Concepts", () => syllabusRepo.listStudiedConcepts());
  await measure("Any app page: layout's Domain list", () => syllabusRepo.listDomains());

  if (!latest) {
    console.log("\nNo Drills yet, so the Drill page and answer reads were skipped.");
    return;
  }

  await measure("Drill page: load Drill and progress", async () => {
    const loaded = await loadDrill({ drillsRepo, questionsRepo }, latest.id);
    const scenario = loaded?.progress.steps.find((step) => step.question.type === "scenario");
    if (scenario) await drillConceptNames(syllabusRepo, [scenario.question]);
  });

  const questions = await questionsRepo.listDrillQuestions(latest.id);
  const question = questions[0];
  if (question) {
    // The reads submitAttempt makes around the grading call, in the same order.
    await measure("Submit answer: reads before grading", async () => {
      const q = await questionsRepo.getQuestion(question.id);
      if (!q?.drillId) return;
      const drillQuestions = await questionsRepo.listDrillQuestions(q.drillId);
      await questionsRepo.listAttemptsForQuestions(drillQuestions.map(({ id }) => id));
      await Promise.all(q.conceptIds.map((id) => syllabusRepo.getConcept(id)));
    });
    await measure("Submit answer: schedule read after grading", () =>
      Promise.all(question.conceptIds.map((id) => syllabusRepo.getConcept(id))),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
