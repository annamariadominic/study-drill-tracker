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

const { POST } = await import("./route");

function post(questionId: string, fields: Record<string, string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    body.set(name, value);
  }
  const request = new NextRequest(`https://drills.example.com/api/questions/${questionId}/attempts`, {
    method: "POST",
    body,
  });
  return POST(request, { params: Promise.resolve({ questionId }) });
}

async function runAfterResponse() {
  for (const callback of fakes.afterResponse.splice(0)) {
    await callback();
  }
}

describe("POST /api/questions/[questionId]/attempts", () => {
  beforeEach(() => {
    fakes.questionsRepo = new FakeQuestionsRepository();
    fakes.syllabusRepo = new FakeSyllabusRepository();
    fakes.llmPort = new FakeLlmPort();
    fakes.afterResponse = [];
  });

  async function studiedConcept() {
    const domain = await fakes.syllabusRepo.createDomain({ name: "Software Engineering" });
    const subject = await fakes.syllabusRepo.createSubject(domain.id, { name: "System Design" });
    const concept = await fakes.syllabusRepo.createConcept(subject.id, { name: "Idempotency" });
    return fakes.syllabusRepo.setConceptStatus(concept.id, "studied");
  }

  it("records a free-text answer and redirects to its feedback before grading it", async () => {
    const concept = await studiedConcept();
    const question = await fakes.questionsRepo.createQuestion({
      conceptIds: [concept.id],
      drillId: "drill-1",
      position: 0,
      type: "recall",
      prompt: "Explain idempotency.",
    });

    const response = await post(question.id, {
      confidence: "confident",
      submittedAnswer: "Same effect however often it runs.",
      drillId: "drill-1",
    });

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/study/drills/drill-1");
    const attemptId = location.searchParams.get("attemptId")!;
    expect((await fakes.questionsRepo.getAttempt(attemptId))?.gradingStatus).toBe("pending");
    expect(fakes.llmPort.gradeAnswerCallCount).toBe(0);

    await runAfterResponse();

    expect((await fakes.questionsRepo.getAttempt(attemptId))?.gradingStatus).toBe("graded");
    expect((await fakes.syllabusRepo.getConcept(concept.id))?.reviewIntervalDays).toBeGreaterThan(1);
  });

  it("grades a flashcard at once and leaves nothing for after the response", async () => {
    const concept = await studiedConcept();
    const question = await fakes.questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "flashcard",
      prompt: "Pick the best definition.",
      options: ["Correct one", "Wrong one"],
      correctOptionIndex: 0,
    });

    const response = await post(question.id, { confidence: "confident", optionIndex: "0" });

    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe(`/study/questions/${question.id}`);
    expect((await fakes.questionsRepo.getAttempt(location.searchParams.get("attemptId")!))?.gradingStatus).toBe(
      "graded",
    );
    expect(fakes.afterResponse).toHaveLength(0);
  });

  it("returns to the Question with an error when the answer can't be recorded", async () => {
    const concept = await studiedConcept();
    const question = await fakes.questionsRepo.createQuestion({
      conceptIds: [concept.id],
      type: "recall",
      prompt: "Explain idempotency.",
    });
    fakes.questionsRepo.createAttempt = async () => {
      throw new Error("database is down");
    };

    const response = await post(question.id, { confidence: "confident", submittedAnswer: "An answer." });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `https://drills.example.com/study/questions/${question.id}?error=submit-failed`,
    );
  });
});
