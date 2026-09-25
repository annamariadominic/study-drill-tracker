# Model settings are chosen per call type: Haiku 4.5 where it held up, Sonnet 5 for scenarios

Every LLM call used to go to Claude Opus 5 with its defaults (adaptive thinking, effort `high`). The learner waits on these calls: a Drill waits for its slowest Question to be written, and a free-text answer waits for its grade. So each call type now gets its own model, effort and speed, set in `LLM_SETTINGS` in `src/lib/llm/anthropic-port.ts`:

| Call type | Setting |
|---|---|
| Write a recall Question | Haiku 4.5 |
| Write a flashcard Question | Haiku 4.5 |
| Write a scenario Question | Sonnet 5, effort `low` |
| Grade a recall answer | Haiku 4.5 |
| Grade a scenario answer | Haiku 4.5 |

The learner chose these from a side-by-side run on their own material: 7 Questions written from real studied Concepts and 5 past free-text Attempts graded again, under Opus 5 at default and low effort, Sonnet 5 at low effort, and Haiku 4.5 (`scripts/compare-llm-settings.ts`, 2026-09-24). The report itself quotes the learner's notes and answers, so it isn't kept in the repo. Median latency per call on that run:

| Call type | Opus 5, default | Opus 5, low | Sonnet 5, low | Haiku 4.5 |
|---|---|---|---|---|
| Write recall | 2.5 s | 2.7 s | 2.1 s | 1.8 s |
| Write flashcard | 5.7 s | 4.9 s | 3.2 s | 3.8 s |
| Write scenario | 18.7 s | 11.7 s | 7.7 s | 4.0 s |
| Grade recall | 20.4 s | 12.0 s | 8.0 s | 6.4 s |
| Grade scenario | 19.6 s | 17.4 s | 12.8 s | 8.2 s |

The whole sample cost $0.28 on Opus 5 at default effort and $0.02 on Haiku 4.5. Quality decided the grading choice: Haiku 4.5 gave the same grade as Opus 5 at default effort on all five Attempts, while Opus 5 and Sonnet 5 at low effort each graded two partial answers as correct. Haiku's strong answers are shorter. Scenario Questions went to Sonnet 5 rather than Haiku because writing one means reasoning about several Concepts together.

Fast mode (Opus 5 at up to 2.5× output speed, twice the price) was a candidate for grading, but this account's fast-mode rate limit is zero, so it couldn't be measured. The port still supports it: a fast-mode request goes through the beta endpoint and falls back to standard speed on a 429.

`max_tokens` now leaves room for thinking (16000 where the model thinks adaptively, 4096 on Haiku 4.5). The old limits of 1024 and 2048 also capped how long Opus 5 could think. That is why the Opus 5 default above is slower than the 7.8 s grade measured before this change.

Changing a setting is one line in `LLM_SETTINGS`. Rerun the comparison script before and after any change, and compare the grades as well as the times.
