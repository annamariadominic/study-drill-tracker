import { describe, expect, it } from "vitest";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { NotFoundError as QuestionsNotFoundError } from "@/lib/questions/errors";
import { FakeLlmPort } from "@/lib/llm/fake-port";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";
import { holdCalls } from "@/lib/testing/held-calls";
import type { QuestionsRepository } from "@/lib/questions/repository";
import type { LlmPort } from "@/lib/llm/port";
import type { SyllabusRepository } from "@/lib/syllabus/repository";
import { GradingNotFailedError } from "./errors";
import { scheduleFromFields, scheduleNextReview } from "./scheduling";
import { gradeAttempt, retryGrading, submitAttempt } from "./submit-attempt";

type Deps = { questionsRepo: QuestionsRepository; syllabusRepo: SyllabusRepository; llmPort: LlmPort };

/**
 * Submits an answer and, where it's left pending, grades it straight away, as
 * the attempts route does once it has responded.
 */
async function answer(deps: Deps, input: Parameters<typeof submitAttempt>[1]) {
  const attempt = await submitAttempt(deps, input);
  return attempt.gradingStatus === "pending" ? gradeAttempt(deps, attempt.id) : attempt;
}

async function buildStudiedConcept(syllabusRepo: FakeSyllabusRepository) {
  const domain = await syllabusRepo.createDomain({ name: "Software Engineering" });
  const subject = await syllabusRepo.createSubject(domain.id, { name: "System Design" });
  const concept = await syllabusRepo.createConcept(subject.id, { name: "Idempotency" });
  return syllabusRepo.setConceptStatus(concept.id, "studied");
}

describe("submitAttempt", () => {
  it("grades a flashcard answer mechanically and never calls the LLM port", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    const attempt = await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "confident", selectedOptionIndex: 0 },
    );

    expect(attempt.correctness).toBe("correct");
    expect(attempt.confidence).toBe("confident");
    expect(llmPort.gradeAnswerCallCount).toBe(0);
  });

  it("marks a wrong flashcard selection incorrect", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    const attempt = await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "guessed", selectedOptionIndex: 1 },
    );

    expect(attempt.correctness).toBe("incorrect");
    expect(attempt.gradedExplanation).toContain("Correct one");
  });

  it("grades a recall answer via the LLM port", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort(undefined, async () => ({
      correctness: "partial",
      explanation: "Close, but missing detail.",
      referenceAnswer: "Repeating it has the same effect as doing it once.",
    }));
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "recall",
      prompt: "Explain idempotency.",
    });

    const attempt = await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "partial", submittedAnswer: "Retrying is safe." },
    );

    expect(attempt.correctness).toBe("partial");
    expect(attempt.gradedExplanation).toBe("Close, but missing detail.");
    expect(llmPort.gradeAnswerCallCount).toBe(1);
  });

  it("persists the reference answer for a partial recall answer", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort(undefined, async () => ({
      correctness: "partial",
      explanation: "You named retries but not why they're safe.",
      referenceAnswer: "An idempotent operation has the same effect however many times it runs.",
    }));
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "recall",
      prompt: "Explain idempotency.",
    });

    const attempt = await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "partial", submittedAnswer: "Retrying is safe." },
    );

    expect(attempt.referenceAnswer).toBe(
      "An idempotent operation has the same effect however many times it runs.",
    );
    expect((await questionsRepo.getAttempt(attempt.id))?.referenceAnswer).toBe(attempt.referenceAnswer);
  });

  it("persists the reference answer for an incorrect recall answer", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort(undefined, async () => ({
      correctness: "incorrect",
      explanation: "That describes caching, not idempotency.",
      referenceAnswer: "An idempotent operation has the same effect however many times it runs.",
    }));
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "recall",
      prompt: "Explain idempotency.",
    });

    const attempt = await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "confident", submittedAnswer: "Storing results for later." },
    );

    expect(attempt.correctness).toBe("incorrect");
    expect((await questionsRepo.getAttempt(attempt.id))?.referenceAnswer).toBe(
      "An idempotent operation has the same effect however many times it runs.",
    );
  });

  it("gives the grader the Question's type and the Concept it was written from", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    await syllabusRepo.updateConcept(concept.id, { notes: "Safe to retry; use idempotency keys." });
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "recall",
      prompt: "Explain idempotency.",
    });

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "partial", submittedAnswer: "Retrying is safe." },
    );

    expect(llmPort.gradeAnswerInputs).toEqual([
      {
        question: { type: "recall", prompt: "Explain idempotency." },
        concepts: [{ name: "Idempotency", notes: "Safe to retry; use idempotency keys." }],
        submittedAnswer: "Retrying is safe.",
      },
    ]);
  });

  it("schedules from correctness and confidence alone, whatever the reference answer says", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort(undefined, async () => ({
      correctness: "partial",
      explanation: "Missing the key idea.",
      referenceAnswer: "A long model answer that has no bearing on scheduling.",
    }));
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "recall",
      prompt: "Explain idempotency.",
    });

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "partial", submittedAnswer: "Retrying is safe." },
    );

    const expected = scheduleNextReview(scheduleFromFields(concept)!, {
      correctness: "partial",
      confidence: "partial",
    });
    const updated = await syllabusRepo.getConcept(concept.id);
    expect(updated?.reviewIntervalDays).toBe(expected.intervalDays);
    expect(updated?.reviewEaseFactor).toBe(expected.easeFactor);
  });

  it("stores no reference answer for a flashcard, which shows its correct option instead", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    const attempt = await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "guessed", selectedOptionIndex: 1 },
    );

    expect(attempt.referenceAnswer).toBeNull();
    expect(attempt.gradedExplanation).toBe('Not quite — the correct answer is "Correct one".');
  });

  it("rejects a flashcard selectedOptionIndex that is out of range", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    await expect(
      submitAttempt(
        { questionsRepo, syllabusRepo },
        { questionId: question.id, confidence: "guessed", selectedOptionIndex: 99 },
      ),
    ).rejects.toThrow(/valid option index/);
  });

  it("throws NotFoundError for a missing question", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();

    await expect(
      submitAttempt(
        { questionsRepo, syllabusRepo },
        { questionId: "missing", confidence: "guessed", submittedAnswer: "x" },
      ),
    ).rejects.toThrow(QuestionsNotFoundError);
  });

  it("updates the Concept's review schedule after a correct attempt", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "confident", selectedOptionIndex: 0 },
    );

    const updatedConcept = await syllabusRepo.getConcept(concept.id);
    expect(updatedConcept?.reviewIntervalDays).toBeGreaterThan(concept.reviewIntervalDays ?? 0);
    expect(updatedConcept?.nextReviewDueAt).not.toBe(concept.nextReviewDueAt);
  });

  it("resets the Concept's review interval to one day after an incorrect attempt", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "guessed", selectedOptionIndex: 1 },
    );

    const updatedConcept = await syllabusRepo.getConcept(concept.id);
    expect(updatedConcept?.reviewIntervalDays).toBe(1);
  });

  it("leaves a Concept's review schedule null if it has since been marked planned again", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });
    await syllabusRepo.setConceptStatus(concept.id, "planned");

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: question.id, confidence: "confident", selectedOptionIndex: 0 },
    );

    const updatedConcept = await syllabusRepo.getConcept(concept.id);
    expect(updatedConcept?.status).toBe("planned");
    expect(updatedConcept?.reviewIntervalDays).toBeNull();
    expect(updatedConcept?.nextReviewDueAt).toBeNull();
  });

  it("advances a Concept's review schedule only once per Drill", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);

    const recall = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      drillId: "drill-1",
      position: 0,
      type: "recall",
      prompt: "Explain idempotency.",
    });
    const flashcard = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      drillId: "drill-1",
      position: 1,
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: recall.id, confidence: "confident", submittedAnswer: "No extra effect." },
    );
    const afterFirst = await syllabusRepo.getConcept(concept.id);

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: flashcard.id, confidence: "confident", selectedOptionIndex: 0 },
    );
    const afterSecond = await syllabusRepo.getConcept(concept.id);

    expect(afterFirst?.reviewIntervalDays).toBeGreaterThan(1);
    expect(afterSecond?.reviewIntervalDays).toBe(afterFirst?.reviewIntervalDays);
    expect(afterSecond?.reviewEaseFactor).toBe(afterFirst?.reviewEaseFactor);
  });

  it("still records the second Attempt on a Concept within a Drill", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);

    const first = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      drillId: "drill-1",
      position: 0,
      type: "recall",
      prompt: "Explain idempotency.",
    });
    const second = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      drillId: "drill-1",
      position: 1,
      type: "recall",
      prompt: "Explain it again.",
    });

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: first.id, confidence: "confident", submittedAnswer: "No extra effect." },
    );
    const attempt = await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: second.id, confidence: "guessed", submittedAnswer: "Something else." },
    );

    expect(await questionsRepo.getAttempt(attempt.id)).toEqual(attempt);
    expect(attempt.correctness).toBe("correct");
  });

  it("advances the schedule again for a Concept reviewed outside a Drill", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);

    const first = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "recall",
      prompt: "Explain idempotency.",
    });
    const second = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "recall",
      prompt: "Explain idempotency again.",
    });

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: first.id, confidence: "confident", submittedAnswer: "No extra effect." },
    );
    const afterFirst = await syllabusRepo.getConcept(concept.id);

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: second.id, confidence: "confident", submittedAnswer: "No extra effect." },
    );
    const afterSecond = await syllabusRepo.getConcept(concept.id);

    expect(afterSecond?.reviewIntervalDays).toBeGreaterThan(afterFirst?.reviewIntervalDays ?? 0);
  });

  it("waits for the recall Attempt to advance the schedule, even when a flashcard on the same Concept is answered first", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);

    const flashcard = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      drillId: "drill-1",
      position: 0,
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });
    const recall = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      drillId: "drill-1",
      position: 1,
      type: "recall",
      prompt: "Explain idempotency.",
    });

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: flashcard.id, confidence: "confident", selectedOptionIndex: 0 },
    );
    const afterFlashcard = await syllabusRepo.getConcept(concept.id);
    expect(afterFlashcard?.reviewIntervalDays).toBe(1);

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: recall.id, confidence: "confident", submittedAnswer: "No extra effect." },
    );

    expect((await syllabusRepo.getConcept(concept.id))?.reviewIntervalDays).toBeGreaterThan(1);
  });

  it("lets a flashcard provide the one scheduling update when the Drill asks nothing else about that Concept", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const llmPort = new FakeLlmPort();
    const concept = await buildStudiedConcept(syllabusRepo);

    const flashcard = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      drillId: "drill-1",
      position: 0,
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    await answer(
      { questionsRepo, syllabusRepo, llmPort },
      { questionId: flashcard.id, confidence: "confident", selectedOptionIndex: 0 },
    );

    expect((await syllabusRepo.getConcept(concept.id))?.reviewIntervalDays).toBeGreaterThan(1);
  });

  describe("scenario Questions", () => {
    async function buildScenarioConcepts(syllabusRepo: FakeSyllabusRepository) {
      const domain = await syllabusRepo.createDomain({ name: "Software Engineering" });
      const systemDesign = await syllabusRepo.createSubject(domain.id, { name: "System Design" });
      const mlSystemDesign = await syllabusRepo.createSubject(domain.id, { name: "ML System Design" });
      const queues = await syllabusRepo.createConcept(systemDesign.id, { name: "Queues" });
      const latency = await syllabusRepo.createConcept(mlSystemDesign.id, { name: "Model latency" });
      return [
        await syllabusRepo.setConceptStatus(queues.id, "studied"),
        await syllabusRepo.setConceptStatus(latency.id, "studied"),
      ];
    }

    async function intervalOf(syllabusRepo: FakeSyllabusRepository, conceptId: string) {
      return (await syllabusRepo.getConcept(conceptId))?.reviewIntervalDays;
    }

    it("grades a scenario answer through the LLM port", async () => {
      const questionsRepo = new FakeQuestionsRepository();
      const syllabusRepo = new FakeSyllabusRepository();
      const llmPort = new FakeLlmPort(undefined, async () => ({
        correctness: "partial",
        explanation: "Covers the queue but not the latency budget.",
        referenceAnswer: "Queue requests, batch them within the latency budget, and shed load past it.",
      }));
      const [queues, latency] = await buildScenarioConcepts(syllabusRepo);
      const scenario = await questionsRepo.createQuestion({
        conceptIds: [queues.id, latency.id],
        drillId: "drill-1",
        position: 0,
        type: "scenario",
        prompt: "Design an inference API under load.",
      });

      const attempt = await answer(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: scenario.id, confidence: "partial", submittedAnswer: "Put a queue in front." },
      );

      expect(llmPort.gradeAnswerCallCount).toBe(1);
      expect(attempt.correctness).toBe("partial");
      expect(attempt.submittedAnswer).toBe("Put a queue in front.");
      expect(attempt.referenceAnswer).toBe(
        "Queue requests, batch them within the latency budget, and shed load past it.",
      );
      expect(llmPort.gradeAnswerInputs[0]).toMatchObject({
        question: { type: "scenario" },
        concepts: [
          { name: "Queues", notes: null },
          { name: "Model latency", notes: null },
        ],
      });
    });

    it("advances every Concept the scenario combined when the Drill asks nothing else about them", async () => {
      const questionsRepo = new FakeQuestionsRepository();
      const syllabusRepo = new FakeSyllabusRepository();
      const llmPort = new FakeLlmPort();
      const [queues, latency] = await buildScenarioConcepts(syllabusRepo);
      const scenario = await questionsRepo.createQuestion({
        conceptIds: [queues.id, latency.id],
        drillId: "drill-1",
        position: 0,
        type: "scenario",
        prompt: "Design an inference API under load.",
      });

      await answer(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: scenario.id, confidence: "confident", submittedAnswer: "Queue and batch." },
      );

      expect(await intervalOf(syllabusRepo, queues.id)).toBeGreaterThan(1);
      expect(await intervalOf(syllabusRepo, latency.id)).toBeGreaterThan(1);
    });

    it("leaves a Concept with its own recall Question to that recall Attempt, even when the scenario is answered first", async () => {
      const questionsRepo = new FakeQuestionsRepository();
      const syllabusRepo = new FakeSyllabusRepository();
      const llmPort = new FakeLlmPort();
      const [queues, latency] = await buildScenarioConcepts(syllabusRepo);
      const recall = await questionsRepo.createQuestion({
        conceptIds: [queues.id],
        drillId: "drill-1",
        position: 0,
        type: "recall",
        prompt: "Explain queues.",
      });
      const scenario = await questionsRepo.createQuestion({
        conceptIds: [queues.id, latency.id],
        drillId: "drill-1",
        position: 1,
        type: "scenario",
        prompt: "Design an inference API under load.",
      });

      await answer(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: scenario.id, confidence: "confident", submittedAnswer: "Queue and batch." },
      );

      expect(await intervalOf(syllabusRepo, queues.id)).toBe(1);
      expect(await intervalOf(syllabusRepo, latency.id)).toBeGreaterThan(1);

      await answer(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: recall.id, confidence: "confident", submittedAnswer: "Buffers work." },
      );

      expect(await intervalOf(syllabusRepo, queues.id)).toBeGreaterThan(1);
    });

    it("never advances a Concept a second time when a flashcard already gave it its one update", async () => {
      const questionsRepo = new FakeQuestionsRepository();
      const syllabusRepo = new FakeSyllabusRepository();
      const llmPort = new FakeLlmPort();
      const [queues, latency] = await buildScenarioConcepts(syllabusRepo);
      const flashcard = await questionsRepo.createQuestion({
        conceptIds: [queues.id],
        drillId: "drill-1",
        position: 0,
        type: "flashcard",
        prompt: "Pick the best definition.",
        options: ["Correct one", "Wrong one"],
        correctOptionIndex: 0,
      });
      const scenario = await questionsRepo.createQuestion({
        conceptIds: [queues.id, latency.id],
        drillId: "drill-1",
        position: 1,
        type: "scenario",
        prompt: "Design an inference API under load.",
      });

      await answer(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: flashcard.id, confidence: "confident", selectedOptionIndex: 0 },
      );
      const queuesAfterFlashcard = await syllabusRepo.getConcept(queues.id);

      await answer(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: scenario.id, confidence: "confident", submittedAnswer: "Queue and batch." },
      );

      const queuesAfterScenario = await syllabusRepo.getConcept(queues.id);
      expect(queuesAfterScenario?.reviewIntervalDays).toBe(queuesAfterFlashcard?.reviewIntervalDays);
      expect(queuesAfterScenario?.nextReviewDueAt).toBe(queuesAfterFlashcard?.nextReviewDueAt);
      expect(await intervalOf(syllabusRepo, latency.id)).toBeGreaterThan(1);
    });

    it("advances the Concepts it combined only once, even if the scenario is answered again", async () => {
      const questionsRepo = new FakeQuestionsRepository();
      const syllabusRepo = new FakeSyllabusRepository();
      const llmPort = new FakeLlmPort();
      const [queues, latency] = await buildScenarioConcepts(syllabusRepo);
      const scenario = await questionsRepo.createQuestion({
        conceptIds: [queues.id, latency.id],
        drillId: "drill-1",
        position: 0,
        type: "scenario",
        prompt: "Design an inference API under load.",
      });

      await answer(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: scenario.id, confidence: "confident", submittedAnswer: "Queue and batch." },
      );
      const afterFirst = await syllabusRepo.getConcept(latency.id);
      await answer(
        { questionsRepo, syllabusRepo, llmPort },
        { questionId: scenario.id, confidence: "confident", submittedAnswer: "Queue and batch." },
      );

      expect((await syllabusRepo.getConcept(latency.id))?.reviewIntervalDays).toBe(
        afterFirst?.reviewIntervalDays,
      );
    });
  });

  it("reads the Drill's Questions and Attempts together, not one after another", async () => {
    const questionsRepo = new FakeQuestionsRepository();
    const syllabusRepo = new FakeSyllabusRepository();
    const concept = await buildStudiedConcept(syllabusRepo);
    const question = await questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "recall",
      prompt: "Explain idempotency.",
      drillId: "drill-1",
      position: 0,
    });

    const held = holdCalls();
    const submitting = submitAttempt(
      { questionsRepo: held.wrap(questionsRepo, ["listDrillQuestions", "listDrillAttempts"]), syllabusRepo },
      { questionId: question.id, confidence: "confident", submittedAnswer: "Same effect however often it runs." },
    );
    await held.settle();

    expect([...held.started].sort()).toEqual(["listDrillAttempts", "listDrillQuestions"]);

    held.release();
    expect((await submitting).advancesConceptIds).toEqual([concept.id]);
  });

  describe("background grading", () => {
    async function recallSetup(grade?: ConstructorParameters<typeof FakeLlmPort>[1]) {
      const questionsRepo = new FakeQuestionsRepository();
      const syllabusRepo = new FakeSyllabusRepository();
      const llmPort = new FakeLlmPort(undefined, grade);
      const concept = await buildStudiedConcept(syllabusRepo);
      const recall = await questionsRepo.createQuestion({
        conceptIds: [concept.id],
        drillId: "drill-1",
        position: 0,
        type: "recall",
        prompt: "Explain idempotency.",
      });
      return { deps: { questionsRepo, syllabusRepo, llmPort }, questionsRepo, syllabusRepo, llmPort, concept, recall };
    }

    it("records a free-text answer as grading pending, without waiting on the grader", async () => {
      const { deps, questionsRepo, llmPort, recall } = await recallSetup();

      const attempt = await submitAttempt(deps, {
        questionId: recall.id,
        confidence: "partial",
        submittedAnswer: "Retrying is safe.",
      });

      expect(attempt).toMatchObject({
        gradingStatus: "pending",
        submittedAnswer: "Retrying is safe.",
        confidence: "partial",
        correctness: null,
        gradedExplanation: null,
        referenceAnswer: null,
      });
      expect(llmPort.gradeAnswerCallCount).toBe(0);
      expect(await questionsRepo.getAttempt(attempt.id)).toEqual(attempt);
    });

    it("records a flashcard answer already graded", async () => {
      const { deps, syllabusRepo, concept } = await recallSetup();
      const flashcard = await deps.questionsRepo.createQuestion({
        conceptIds: [concept.id],
        type: "flashcard",
        prompt: "Pick the best definition.",
        options: ["Correct one", "Wrong one"],
        correctOptionIndex: 0,
      });

      const attempt = await submitAttempt(deps, {
        questionId: flashcard.id,
        confidence: "confident",
        selectedOptionIndex: 0,
      });

      expect(attempt.gradingStatus).toBe("graded");
      expect((await syllabusRepo.getConcept(concept.id))?.reviewIntervalDays).toBeGreaterThan(1);
    });

    it("leaves the review schedule alone while pending, and advances it once graded", async () => {
      const { deps, syllabusRepo, concept, recall } = await recallSetup(async () => ({
        correctness: "correct",
        explanation: "Right.",
        referenceAnswer: "Same effect however often it runs.",
      }));

      const pending = await submitAttempt(deps, {
        questionId: recall.id,
        confidence: "confident",
        submittedAnswer: "No extra effect.",
      });
      expect(await syllabusRepo.getConcept(concept.id)).toEqual(concept);

      const graded = await gradeAttempt(deps, pending.id);

      expect(graded).toMatchObject({
        id: pending.id,
        gradingStatus: "graded",
        correctness: "correct",
        gradedExplanation: "Right.",
        referenceAnswer: "Same effect however often it runs.",
      });
      const expected = scheduleNextReview(scheduleFromFields(concept)!, {
        correctness: "correct",
        confidence: "confident",
      });
      const updated = await syllabusRepo.getConcept(concept.id);
      expect(updated?.reviewIntervalDays).toBe(expected.intervalDays);
      expect(updated?.reviewEaseFactor).toBe(expected.easeFactor);
    });

    it("counts a pending Attempt as the Drill's signal, so a later Attempt can't claim the update", async () => {
      const { deps, syllabusRepo, concept, recall } = await recallSetup();
      const flashcard = await deps.questionsRepo.createQuestion({
        conceptIds: [concept.id],
        drillId: "drill-1",
        position: 1,
        type: "flashcard",
        prompt: "Pick the best definition.",
        options: ["Correct one", "Wrong one"],
        correctOptionIndex: 0,
      });

      const pending = await submitAttempt(deps, {
        questionId: recall.id,
        confidence: "confident",
        submittedAnswer: "No extra effect.",
      });
      const flashcardAttempt = await submitAttempt(deps, {
        questionId: flashcard.id,
        confidence: "confident",
        selectedOptionIndex: 0,
      });

      expect(pending.advancesConceptIds).toEqual([concept.id]);
      expect(flashcardAttempt.advancesConceptIds).toEqual([]);
      expect((await syllabusRepo.getConcept(concept.id))?.reviewIntervalDays).toBe(1);

      await gradeAttempt(deps, pending.id);
      expect((await syllabusRepo.getConcept(concept.id))?.reviewIntervalDays).toBeGreaterThan(1);
    });

    it("marks the Attempt failed when the grader fails, and advances nothing", async () => {
      const { deps, questionsRepo, syllabusRepo, concept, recall } = await recallSetup(async () => {
        throw new Error("LLM is down");
      });
      const pending = await submitAttempt(deps, {
        questionId: recall.id,
        confidence: "confident",
        submittedAnswer: "No extra effect.",
      });

      const failed = await gradeAttempt(deps, pending.id);

      expect(failed).toMatchObject({ id: pending.id, gradingStatus: "failed", correctness: null });
      expect(await questionsRepo.getAttempt(pending.id)).toEqual(failed);
      expect(await syllabusRepo.getConcept(concept.id)).toEqual(concept);
    });

    it("grades a failed Attempt again on retry, and only then advances the schedule", async () => {
      let graderUp = false;
      const { deps, syllabusRepo, concept, recall } = await recallSetup(async () => {
        if (!graderUp) {
          throw new Error("LLM is down");
        }
        return { correctness: "correct", explanation: "Right.", referenceAnswer: "Same effect." };
      });
      const pending = await submitAttempt(deps, {
        questionId: recall.id,
        confidence: "confident",
        submittedAnswer: "No extra effect.",
      });
      await gradeAttempt(deps, pending.id);

      graderUp = true;
      const reopened = await retryGrading(deps, pending.id);
      expect(reopened.gradingStatus).toBe("pending");
      expect((await syllabusRepo.getConcept(concept.id))?.reviewIntervalDays).toBe(1);

      const graded = await gradeAttempt(deps, pending.id);
      expect(graded).toMatchObject({ gradingStatus: "graded", correctness: "correct" });
      expect((await syllabusRepo.getConcept(concept.id))?.reviewIntervalDays).toBeGreaterThan(1);
    });

    it("refuses to retry an Attempt whose grading hasn't failed", async () => {
      const { deps, recall } = await recallSetup();
      const pending = await submitAttempt(deps, {
        questionId: recall.id,
        confidence: "confident",
        submittedAnswer: "No extra effect.",
      });

      await expect(retryGrading(deps, pending.id)).rejects.toThrow(GradingNotFailedError);
      await gradeAttempt(deps, pending.id);
      await expect(retryGrading(deps, pending.id)).rejects.toThrow(GradingNotFailedError);
      await expect(retryGrading(deps, "missing")).rejects.toThrow(QuestionsNotFoundError);
    });

    it("advances the schedule once, even if the same pending Attempt is graded twice", async () => {
      const { deps, syllabusRepo, llmPort, concept, recall } = await recallSetup();
      const pending = await submitAttempt(deps, {
        questionId: recall.id,
        confidence: "confident",
        submittedAnswer: "No extra effect.",
      });

      const [first, second] = await Promise.all([gradeAttempt(deps, pending.id), gradeAttempt(deps, pending.id)]);
      const afterBoth = await syllabusRepo.getConcept(concept.id);
      await gradeAttempt(deps, pending.id);

      expect(first.gradingStatus).toBe("graded");
      expect(second.gradingStatus).toBe("graded");
      expect(llmPort.gradeAnswerCallCount).toBeLessThanOrEqual(2);
      const once = scheduleNextReview(scheduleFromFields(concept)!, { correctness: "correct", confidence: "confident" });
      expect(afterBoth?.reviewIntervalDays).toBe(once.intervalDays);
      expect(afterBoth?.reviewEaseFactor).toBe(once.easeFactor);
      expect(await syllabusRepo.getConcept(concept.id)).toEqual(afterBoth);
    });

    it("throws NotFoundError when grading a missing Attempt", async () => {
      const { deps } = await recallSetup();
      await expect(gradeAttempt(deps, "missing")).rejects.toThrow(QuestionsNotFoundError);
    });
  });
});
