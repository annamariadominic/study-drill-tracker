# A Drill asks at most one scenario, after its recall and flashcard Questions

Ticket #7 described scenario Questions as "interleaved" with recall and flashcard Questions. Instead, a due Drill asks at most one scenario, as its last Question. It combines two or three of the due Concepts in the Drill's Domain, taking the best-ranked Concept from each Subject first so it spans Subjects where it can.

Putting the scenario last follows from ADR 0006. A Concept's one scheduling update comes from its recall Question where the Drill has one, so the order doesn't change which Attempt schedules it. The order does change what the learner sees, though: meeting a Concept inside a scenario before being asked to recall it would give away part of the recall answer. Asking the scenario last also makes it the applied check after the basics, which is the order the syllabus is studied in. There's only one scenario because each one costs a slow LLM call to generate and another to grade, and a single one covering up to three Concepts already puts them together.

The scenario's slot counts against the Drill's question limit and is kept back from the recall and flashcard Questions. The exception is when keeping it back would leave room for none of them, as in a one-Question Drill or two weak Concepts with a limit of two. Then the scenario is dropped, so a Drill is never a scenario alone.

We considered spreading scenarios between the per-Concept Questions, as the ticket described, and allowing several per Drill. Both give away recall answers early and multiply LLM calls without adding much. This is easy to revisit: composition is one pure function, and nothing stored depends on where the scenario sits.
