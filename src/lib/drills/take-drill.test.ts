import { describe, expect, it } from "vitest";
import { FakeLlmPort } from "@/lib/llm/fake-port";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { submitAttempt } from "@/lib/study/submit-attempt";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";
import { drillProgress } from "./drill-progress";
import { FakeDrillsRepository } from "./fake-repository";
import { startDueDrill } from "./start-due-drill";

describe("taking a Drill", () => {
  it("updates each answered Concept's review schedule as the Drill is worked through", async () => {
    const syllabusRepo = new FakeSyllabusRepository();
    const drillsRepo = new FakeDrillsRepository();
    const questionsRepo = new FakeQuestionsRepository();
    const llmPort = new FakeLlmPort();

    const domain = await syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const conceptIds: string[] = [];
    for (const name of ["Idempotency", "Backpressure"]) {
      const concept = await syllabusRepo.createConcept(subject.id, { name });
      await syllabusRepo.setConceptStatus(concept.id, "studied");
      conceptIds.push(concept.id);
    }

    const drill = await startDueDrill(
      { syllabusRepo, drillsRepo, questionsRepo, llmPort },
      { domainId: domain.id },
    );

    const loadProgress = async () => {
      const questions = await questionsRepo.listDrillQuestions(drill.id);
      const attempts = await questionsRepo.listAttemptsForQuestions(
        questions.map((question) => question.id),
      );
      return drillProgress(questions, attempts);
    };

    const startedAt = Date.now();
    let progress = await loadProgress();
    expect(progress.completed).toBe(false);

    while (progress.currentQuestion) {
      const question = progress.currentQuestion;
      await submitAttempt(
        { questionsRepo, syllabusRepo, llmPort },
        {
          questionId: question.id,
          confidence: "confident",
          submittedAnswer: question.type === "recall" ? "An answer." : undefined,
          selectedOptionIndex: question.type === "flashcard" ? 0 : undefined,
        },
      );

      progress = await loadProgress();
    }

    expect(progress.completed).toBe(true);
    expect(progress.summary.total).toBeGreaterThan(0);
    expect(progress.summary.correct).toBe(progress.summary.total);

    for (const conceptId of conceptIds) {
      const concept = await syllabusRepo.getConcept(conceptId);
      expect(concept?.nextReviewDueAt).toBeTruthy();
      expect(new Date(concept?.nextReviewDueAt ?? 0).getTime()).toBeGreaterThan(startedAt);
    }
  });
});
