# Latency investigation: slow Drill generation, grading and navigation

_Investigated 2026-09-25. Nothing here has been implemented yet._

## Summary

There are two separate sources of delay, and they add up:

1. **The model call** dominates the slowest interactions. Grading a free-text answer takes about **8 s** and starting a Drill about **3.7 s** in Claude alone.
2. **The database is on the other side of the country.** Vercel runs the app's functions in `iad1` (Virginia) and Supabase is in `us-west-2` (Oregon). Every query costs about **125–160 ms**, and each interaction makes several queries one after another. That adds about **1–2 s per interaction**, including after every redirect.

Also, nothing gives feedback on link navigations (there's no `loading.tsx`), so "Next question" and page changes feel frozen for the half-second or more the page's queries take.

## Where the time goes

Estimated from measured parts. Database times were measured from the US east coast, which is roughly where the deployed functions are.

| Interaction | DB before | Model | DB after + redirect | Rough total |
|---|---|---|---|---|
| Start a due Drill | ~1.0 s (29 requests, 4 sequential) | ~3.7 s (slowest of 10 parallel) | ~0.25 s writes + ~0.6 s Drill page | **~5.5 s** |
| Submit a free-text answer | ~0.5 s (4 sequential) | ~7.8 s grading | ~0.4 s writes/schedule + ~0.6 s Drill page | **~9.3 s** |
| Submit a flashcard answer | ~0.5 s | none | ~1.0 s | **~1.5 s** |
| "Next question" / page links | none | none | ~0.6 s Drill page (Study pages ~0.9 s) | **~0.6–1 s, with no feedback** |

Scenario Questions have longer prompts and answers than the sample benchmark, so they're likely slower than these figures.

### Evidence

**Regions.** `x-vercel-id` on production function responses reads `iad1::iad1`. `vercel.json` sets no region, so it's the default. The database host resolves to `2600:1f14::/34`, which AWS's published ranges list as `us-west-2`.

**Database** (`scripts/measure-db-latency.ts`, read-only, median of 3):

| Path | Requests | Sequential | Time |
|---|---|---|---|
| One small query, warm | 1 | 1 | ~125–157 ms |
| Start due Drill: read due Concepts | 29 | 4 | 1037 ms |
| Study / Random Drill page: studied Concepts | 28 | 3 | 904 ms |
| Drill page: load Drill and progress | 6 | 4 | 603 ms |
| Submit answer: reads before grading | 4 | 4 | 524 ms |

The syllabus reads are N+1: one query for Domains, then one per Domain for Subjects, then one per Subject for Concepts (3 Domains and 24 Subjects today). This grows with the library.

**Model** (`scripts/measure-llm-latency.ts`, sample recall Question and grading):

| Settings | Write 1 Question | Drill waits (10 parallel) | Grade 1 answer | Grading output tokens |
|---|---|---|---|---|
| **Current**: `claude-opus-5`, defaults (adaptive thinking, effort high) | 2.5 s | 3.7 s | 7.8 s | ~500–580 |
| `claude-opus-5`, effort `low` | 2.4 s | 3.4 s | 6.7 s | ~350–400 |
| `claude-sonnet-5`, effort `low` | 1.9 s | 2.0 s | 4.7 s | ~325–335 |
| `claude-haiku-4-5` | 1.7 s | 1.7 s | 3.5 s | ~245–280 |

No run failed to parse and none hit `max_tokens`. Question writing produces only about 50 output tokens, so thinking isn't the cost there; it's fixed per-call overhead. Grading time is driven by output length: explanation plus reference answer, which #13 added.

## Possible fixes

Ranked by impact for the effort. Model and quality trade-offs are yours to decide. The model fixes should be checked against real Questions and answers before switching.

### 1. Run the functions next to the database (small change, ~1–2 s per interaction)

Add `"regions": ["pdx1"]` (Portland, us-west-2) to `vercel.json`. Each query then stays inside the region instead of crossing the country. The browser-to-function hop gets longer, but that's once per request rather than once per query. The alternative, moving the Supabase project east, is a data migration and much more work.

Verify afterwards: `x-vercel-id` should read `pdx1`, and `scripts/measure-db-latency.ts` run from a `pdx1` function (or Vercel's observability) should show single-digit to low-tens-of-ms queries.

### 2. Make grading faster (largest single delay, ~8 s)

Options, roughly from least to most change:

- **Opus 5 fast mode** (`speed: "fast"`, beta `fast-mode-2026-02-01`). Same model and quality, up to 2.5× output speed, at 2× the per-token price. Grading is output-bound, so this targets the right thing. It's a research preview on the Claude API only.
- **Lower effort on Opus 5** (`output_config.effort: "low"`): measured 7.8 → 6.7 s, with shorter output.
- **Sonnet 5 at low effort**: measured 7.8 → 4.7 s. It's a quality change, so compare grades and reference answers on a sample of past Attempts first.
- **Shorter output**: tighten the reference-answer instruction (e.g. a word cap). Every token saved is saved time.
- **Don't block on grading.** Record the answer, return to the Drill at once, and fill in the grade when it arrives (polling or streaming). This hides the wait, but it's a UX and architecture change, not a tweak.

### 3. Make Drill generation faster (~3.7 s)

- **A faster model for recall and flashcard Questions.** These are short, simple writes. Sonnet 5 at low effort made the ten-in-parallel wait 3.7 → 2.0 s, and Haiku 4.5 1.7 s. Scenario Questions could stay on Opus 5.
- **Show the first Question sooner.** Write Question 1, open the Drill, and write the rest in the background. This is a larger change, and it needs care with the rule that a Drill is persisted only once fully generated.

### 4. Cut database round trips (~0.5–1 s, grows with the library)

Worth doing even after #1, because it removes the N+1 growth:

- Read the studied or due syllabus in **one query** with embedded relations (Concepts with their Subject and Domain), instead of Domains → Subjects → Concepts. That's 29 requests down to 1.
- **Run independent reads in parallel**: in `loadDrill`, get the Drill and its Questions at the same time. In `submitAttempt`, run the "which Concepts advance" reads alongside the grading call instead of before it.
- Fetch a Drill's Questions and Attempts in one embedded query.

### 5. Show feedback on navigation (small change, perceived speed)

Add `loading.tsx` for the Drill route and the Study pages, so links like "Next question" show a skeleton at once instead of appearing to do nothing. Form submits already show a spinner through `PendingSubmit`.

## Not the cause (checked)

- **Adaptive thinking.** It's on by default for Opus 5, but these prompts use very few output tokens. Lower effort helps grading a little, mostly by shortening the answer.
- **Parse failures and retries.** None were seen in 64 calls.
- **Structured outputs.** The schema compiles once, then it's cached for 24 hours.
- **Prompt caching.** The prompts are below the minimum cacheable length, so it wouldn't help.

## Open questions

- Function cold starts: check Vercel observability for p95 function duration and cold-start rate. They weren't measured here.
- Scenario Questions: their generation and grading were not benchmarked separately. Worth adding a scenario case to the benchmark before choosing a model.
