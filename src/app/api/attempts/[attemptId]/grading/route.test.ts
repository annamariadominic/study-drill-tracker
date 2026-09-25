import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeLlmPort } from "@/lib/llm/fake-port";
import { FakeQuestionsRepository } from "@/lib/questions/fake-repository";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";

const fakes = vi.hoisted(() => ({
  questionsRepo: undefined as unknown as FakeQuestionsRepository,
  syllabusRepo: undefined as unknown as FakeSyllabusRepository,
  llmPort: undefined as unknown as FakeLlmPort,
  /** Work the route handed to after(), run by the test once the response is back. */
  afterResponse: [] as (() => unknown)[],
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => {
    fakes.afterResponse.push(callback);
  },
}));
vi.mock("@/lib/questions/get-repository", () => ({ getQuestionsRepository: () => fakes.questionsRepo }));
vi.mock("@/lib/syllabus/get-repository", () => ({ getSyllabusRepository: () => fakes.syllabusRepo }));
vi.mock("@/lib/llm/get-port", () => ({ getLlmPort: () => fakes.llmPort }));

const { GET, POST } = await import("./route");

const params = (attemptId: string) => ({ params: Promise.resolve({ attemptId }) });
const url = (attemptId: string) => `https://drills.example.com/api/attempts/${attemptId}/grading`;

async function runAfterResponse() {
  for (const callback of fakes.afterResponse.splice(0)) {
    await callback();
  }
}

describe("/api/attempts/[attemptId]/grading", () => {
  beforeEach(() => {
    fakes.questionsRepo = new FakeQuestionsRepository();
    fakes.syllabusRepo = new FakeSyllabusRepository();
    fakes.llmPort = new FakeLlmPort();
    fakes.afterResponse = [];
  });

  async function pendingAttempt(drillId: string | null = "drill-1") {
    const question = await fakes.questionsRepo.createQuestion({
      conceptIds: ["concept-1"],
      drillId,
      position: drillId ? 0 : null,
      type: "recall",
      prompt: "Explain idempotency.",
    });
    const attempt = await fakes.questionsRepo.createAttempt({
      questionId: question.id,
      submittedAnswer: "Same effect however often it runs.",
      confidence: "confident",
      advancesConceptIds: [],
    });
    return { question, attempt };
  }

  describe("GET", () => {
    it("reports the Attempt's grading status", async () => {
      const { attempt } = await pendingAttempt();

      const pending = await GET(new NextRequest(url(attempt.id)), params(attempt.id));
      expect(pending.status).toBe(200);
      expect(await pending.json()).toEqual({ gradingStatus: "pending" });

      await fakes.questionsRepo.markGradingFailed(attempt.id);
      const failed = await GET(new NextRequest(url(attempt.id)), params(attempt.id));
      expect(await failed.json()).toEqual({ gradingStatus: "failed" });
    });

    it("is 404 for a missing Attempt", async () => {
      const response = await GET(new NextRequest(url("missing")), params("missing"));
      expect(response.status).toBe(404);
    });
  });

  describe("POST (retry grading)", () => {
    it("reopens a failed Attempt, returns to its feedback, then grades it", async () => {
      const { attempt } = await pendingAttempt();
      await fakes.questionsRepo.markGradingFailed(attempt.id);

      const response = await POST(new NextRequest(url(attempt.id), { method: "POST" }), params(attempt.id));

      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(
        `https://drills.example.com/study/drills/drill-1?attemptId=${attempt.id}`,
      );
      expect((await fakes.questionsRepo.getAttempt(attempt.id))?.gradingStatus).toBe("pending");

      await runAfterResponse();

      expect((await fakes.questionsRepo.getAttempt(attempt.id))?.gradingStatus).toBe("graded");
    });

    it("returns a one-off Question's Attempt to the Question's page", async () => {
      const { question, attempt } = await pendingAttempt(null);
      await fakes.questionsRepo.markGradingFailed(attempt.id);

      const response = await POST(new NextRequest(url(attempt.id), { method: "POST" }), params(attempt.id));

      expect(response.headers.get("location")).toBe(
        `https://drills.example.com/study/questions/${question.id}?attemptId=${attempt.id}`,
      );
    });

    it("leaves an Attempt that hasn't failed alone, and goes back to its feedback", async () => {
      const { attempt } = await pendingAttempt();

      const response = await POST(new NextRequest(url(attempt.id), { method: "POST" }), params(attempt.id));

      expect(response.status).toBe(303);
      expect(fakes.afterResponse).toHaveLength(0);
      expect(fakes.llmPort.gradeAnswerCallCount).toBe(0);
    });

    it("is 404 for a missing Attempt", async () => {
      const response = await POST(new NextRequest(url("missing"), { method: "POST" }), params("missing"));
      expect(response.status).toBe(404);
    });
  });
});
