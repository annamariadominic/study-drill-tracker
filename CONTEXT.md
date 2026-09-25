# Study Drill Tracker

A personal, single-user app for tracking what you've learned across subjects and generating spaced-repetition review sessions from it, without hand-authoring questions.

## Language

**Domain**:
The broadest grouping (e.g. "Software Engineering"). Drills never cross Domains; scenario questions never combine Concepts from different Domains.

**Subject**:
A named area of study within a Domain (e.g. System Design, ML System Design, API Design). Multiple Subjects can share a Domain, which allows their Concepts to combine in scenario questions.
_Avoid_: Topic (see Concept, below — this word shifted meaning during design and Concept is now canonical for the granular unit).

**Concept**:
The atomic unit of study within a Subject (e.g. queues, retries, idempotency, caching, model latency). Has a name and optional free-text notes. A Concept exists in one of two states: **planned** (listed in the syllabus, not yet learned) or **studied** (marked learned; only studied Concepts enter the review schedule or appear in Drills). Notes can be added or enriched after a Concept is already studied.
_Avoid_: Topic.

**Drill**:
A generated review session made of multiple Questions, created on demand (never pre-authored or stored as a bank). Stays within a single Domain. Drawn either from the due-list (Concepts whose review schedule says they're due) or started on demand as a **random Drill**, optionally scoped to the whole library, a single Subject, or hand-picked Concepts. A random Drill over the whole library still draws just one Domain to stay in (see ADR 0009).

**Question**:
A single item within a Drill. Comes in three kinds:
- **Recall**: a plain active-recall prompt on one Concept ("Explain bounded concurrency").
- **Flashcard**: a multiple-choice question, graded mechanically.
- **Scenario**: a free-text prompt combining two or more Concepts, possibly from different Subjects within the same Domain. Any studied Concept is eligible for a Scenario question immediately — there is no minimum maturity requirement.

**Attempt**:
A recorded answer to one Question, carrying a Confidence and, once graded, a Correctness. A Flashcard Attempt is graded as it's recorded. A Recall or Scenario Attempt is recorded first with its **grading pending**, graded by the LLM in the background, and ends **graded** or, if grading fails, **failed** until a retry succeeds (see ADR 0011). It counts as answered while pending.

**Correctness**:
The graded outcome of an Attempt: **correct**, **partial**, or **incorrect**. Flashcard questions are graded mechanically; Recall and Scenario questions are graded by an LLM on this same 3-way scale.

**Confidence**:
A self-reported rating on an Attempt, one of **guessed**, **partial**, or **confident**. Submitted at the same time as the answer, before Correctness is revealed, so it isn't biased by already knowing the grade.

**Review schedule**:
Per-Concept spaced-repetition state that determines when a Concept next becomes due. Updated from Attempts on that Concept, in any Drill (due or random), using both Correctness and Confidence as input, once the Attempt is graded. A Drill advances a Concept's schedule at most once, even where it asks about that Concept more than once: the first recall Attempt is the signal where the Drill has one, otherwise the first Attempt on whatever it does ask (see ADR 0006).
