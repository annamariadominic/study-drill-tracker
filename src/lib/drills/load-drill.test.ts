import { describe, expect, it } from "vitest";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { holdCalls } from "@/lib/testing/held-calls";
import { FakeDrillsRepository } from "./fake-repository";
import { loadDrill } from "./load-drill";

describe("loadDrill", () => {
  it("reads the Drill, its Questions and their Attempts together, not one after another", async () => {
    const drillsRepo = new FakeDrillsRepository();
    const questionsRepo = new FakeQuestionsRepository();
    const drill = await drillsRepo.createDrill({ domainId: "domain-1", scope: "due" });
    const question = await questionsRepo.createQuestion({
      conceptIds: ["concept-1"],
      type: "recall",
      prompt: "Explain idempotency.",
      drillId: drill.id,
      position: 0,
    });
    const attempt = await questionsRepo.createAttempt({
      questionId: question.id,
      submittedAnswer: "Same effect however often it runs.",
      confidence: "confident",
      correctness: "correct",
      gradedExplanation: "Correct.",
    });

    const held = holdCalls();
    const loading = loadDrill(
      {
        drillsRepo: held.wrap(drillsRepo, ["getDrill"]),
        questionsRepo: held.wrap(questionsRepo, ["listDrillQuestions", "listDrillAttempts"]),
      },
      drill.id,
    );
    await held.settle();

    expect([...held.started].sort()).toEqual(["getDrill", "listDrillAttempts", "listDrillQuestions"]);

    held.release();
    const loaded = await loading;
    expect(loaded?.drill).toEqual(drill);
    expect(loaded?.progress.steps).toEqual([{ question, attempt }]);
  });

  it("is null for a missing Drill", async () => {
    expect(
      await loadDrill(
        { drillsRepo: new FakeDrillsRepository(), questionsRepo: new FakeQuestionsRepository() },
        "missing",
      ),
    ).toBeNull();
  });
});
