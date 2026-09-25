import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DrillProgressBar } from "@/components/ui/drill-progress";
import { drillProgress } from "@/lib/drills/drill-progress";
import type { Drill } from "@/lib/drills/types";
import type { Attempt, Correctness, Question } from "@/lib/questions/types";
import { DrillResults } from "./drill";

// The grading watcher refreshes through the App Router, which isn't mounted here.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const drill: Drill = { id: "d1", domainId: "dom1", scope: "due", scopeDetail: null, createdAt: "2026-01-01T00:00:00.000Z" };

function question(id: string, position: number): Question {
  return {
    id,
    conceptIds: [`c-${id}`],
    drillId: "d1",
    position,
    type: "recall",
    prompt: `Explain ${id}.`,
    options: null,
    correctOptionIndex: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function attempt(id: string, questionId: string, grade: Correctness | "pending" | "failed"): Attempt {
  const base = {
    id,
    questionId,
    submittedAnswer: "An answer.",
    confidence: "partial" as const,
    advancesConceptIds: [],
    createdAt: "2026-01-01T00:01:00.000Z",
  };
  return grade === "pending" || grade === "failed"
    ? { ...base, gradingStatus: grade, correctness: null, gradedExplanation: null, referenceAnswer: null }
    : { ...base, gradingStatus: "graded", correctness: grade, gradedExplanation: "Because.", referenceAnswer: null };
}

function textOf(markup: string) {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const questions = [question("q1", 0), question("q2", 1), question("q3", 2)];
const conceptNames = new Map([
  ["c-q1", "Queues"],
  ["c-q2", "Retries"],
  ["c-q3", "Caching"],
]);

describe("DrillResults", () => {
  it("counts only graded answers and shows the rest as grading or not graded", () => {
    const progress = drillProgress(questions, [
      attempt("a1", "q1", "correct"),
      attempt("a2", "q2", "pending"),
      attempt("a3", "q3", "failed"),
    ]);

    const text = textOf(renderToStaticMarkup(<DrillResults drill={drill} progress={progress} conceptNames={conceptNames} />));

    expect(text).toContain("1 of 3 correct");
    expect(text).toContain("1 still grading");
    expect(text).toMatch(/Retries Recall Grading…/);
    expect(text).toMatch(/Caching Recall Couldn't grade/);
  });

  it("reads as before once everything is graded", () => {
    const progress = drillProgress(questions, [
      attempt("a1", "q1", "correct"),
      attempt("a2", "q2", "partial"),
      attempt("a3", "q3", "incorrect"),
    ]);

    const text = textOf(renderToStaticMarkup(<DrillResults drill={drill} progress={progress} conceptNames={conceptNames} />));

    expect(text).toContain("1 of 3 correct");
    expect(text).not.toContain("grading");
    expect(text).not.toContain("Grading");
  });
});

describe("DrillProgressBar", () => {
  it("counts an answer still being graded as answered, and marks its segment as grading", () => {
    const markup = renderToStaticMarkup(<DrillProgressBar outcomes={["correct", "grading", null]} currentIndex={2} />);

    expect(textOf(markup)).toContain("2 of 3 answered");
    expect(markup).toContain('data-outcome="grading"');
  });
});
