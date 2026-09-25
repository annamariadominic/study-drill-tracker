import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Attempt, GradedAttempt, Question, QuestionType, UngradedAttempt } from "@/lib/questions/types";
import { AttemptFeedback, QuestionPrompt } from "./question";

// The grading watcher refreshes through the App Router, which isn't mounted here.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

function question(type: QuestionType, overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    conceptIds: type === "scenario" ? ["c1", "c2"] : ["c1"],
    drillId: "d1",
    position: 0,
    type,
    prompt: "Explain idempotency.",
    options: type === "flashcard" ? ["Right", "Wrong"] : null,
    correctOptionIndex: type === "flashcard" ? 0 : null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function attempt(overrides: Partial<GradedAttempt> = {}): GradedAttempt {
  return {
    id: "a1",
    questionId: "q1",
    submittedAnswer: "Retrying is safe.",
    confidence: "partial",
    advancesConceptIds: ["c1"],
    gradingStartedAt: new Date().toISOString(),
    gradingStatus: "graded",
    correctness: "partial",
    gradedExplanation: "You missed why retrying is safe.",
    referenceAnswer: "An idempotent operation has the same effect however many times it runs.",
    createdAt: "2026-01-01T00:01:00.000Z",
    ...overrides,
  };
}

function ungraded(gradingStatus: UngradedAttempt["gradingStatus"]): UngradedAttempt {
  return {
    ...attempt(),
    gradingStatus,
    correctness: null,
    gradedExplanation: null,
    referenceAnswer: null,
  };
}

/** The markup reduced to its visible text, in order. */
function textOf(markup: string) {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function feedbackText(q: Question, a: Attempt) {
  return textOf(renderToStaticMarkup(<AttemptFeedback question={q} attempt={a} />));
}

describe("AttemptFeedback", () => {
  it.each(["partial", "incorrect", "correct"] as const)(
    "shows a %s recall answer, the feedback and a strong answer, in that order",
    (correctness) => {
      const text = feedbackText(question("recall"), attempt({ correctness }));

      const order = [
        "Your answer",
        "Retrying is safe.",
        "Feedback",
        "You missed why retrying is safe.",
        "A strong answer",
        "An idempotent operation has the same effect however many times it runs.",
      ].map((part) => text.indexOf(part));
      expect(order.every((index) => index >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    },
  );

  it("shows a scenario's answer, feedback and strong answer", () => {
    const text = feedbackText(
      question("scenario", { prompt: "Design an inference API under load." }),
      attempt({
        correctness: "incorrect",
        submittedAnswer: "Scale up.",
        gradedExplanation: "Doesn't address the latency budget.",
        referenceAnswer: "Queue requests and batch them within the latency budget.",
      }),
    );

    expect(text).toContain("Your answer Scale up.");
    expect(text).toContain("Feedback Doesn't address the latency budget.");
    expect(text).toContain("A strong answer Queue requests and batch them within the latency budget.");
  });

  it("renders an Attempt graded before reference answers existed without the section", () => {
    const text = feedbackText(question("recall"), attempt({ referenceAnswer: null }));

    expect(text).toContain("Your answer Retrying is safe.");
    expect(text).toContain("Feedback You missed why retrying is safe.");
    expect(text).not.toContain("A strong answer");
  });

  it("keeps flashcard feedback to the chosen and correct options", () => {
    const text = feedbackText(
      question("flashcard"),
      attempt({
        correctness: "incorrect",
        submittedAnswer: "Wrong",
        gradedExplanation: 'Not quite — the correct answer is "Right".',
        referenceAnswer: null,
      }),
    );

    expect(text).toContain("Your answer Wrong");
    expect(text).toContain("Correct answer Right");
    expect(text).toContain('Feedback Not quite — the correct answer is "Right".');
    expect(text).not.toContain("A strong answer");
  });
});

describe("AttemptFeedback while grading", () => {
  it("shows the answer at once, with the grade, feedback and strong answer still grading", () => {
    const text = feedbackText(question("recall"), ungraded("pending"));

    const order = ["Grading", "Your confidence: Partly sure", "Your answer", "Retrying is safe.", "Feedback", "Grading", "A strong answer", "Grading"];
    let from = 0;
    for (const part of order) {
      const index = text.indexOf(part, from);
      expect(index, `"${part}" after position ${from} in: ${text}`).toBeGreaterThanOrEqual(0);
      from = index + part.length;
    }
    expect(text).not.toMatch(/Correct|Incorrect|Partially correct/);
    expect(text).not.toContain("Retry grading");
  });

  it("offers the way on while grading", () => {
    const markup = renderToStaticMarkup(
      <AttemptFeedback question={question("recall")} attempt={ungraded("pending")} next={<a href="/next">Next question</a>} />,
    );

    expect(textOf(markup)).toContain("Next question");
  });

  it("says a failed answer couldn't be graded and offers to retry it", () => {
    const markup = renderToStaticMarkup(<AttemptFeedback question={question("scenario")} attempt={ungraded("failed")} />);
    const text = textOf(markup);

    expect(text).toContain("Your answer Retrying is safe.");
    expect(text).toContain("couldn't be graded");
    expect(text).toContain("Retry grading");
    expect(markup).toContain('action="/api/attempts/a1/grading"');
    expect(markup).toMatch(/method="post"/);
    expect(text).not.toContain("A strong answer");
  });

  it("offers to retry a grade stalled past the time limit", () => {
    const stalled = { ...ungraded("pending"), gradingStartedAt: "2000-01-01T00:00:00.000Z" };

    const text = feedbackText(question("recall"), stalled);

    expect(text).toContain("couldn't be graded");
    expect(text).toContain("Retry grading");
    expect(text).not.toContain("Grading…");
  });
});

describe("QuestionPrompt", () => {
  function headingClass(q: Question) {
    const markup = renderToStaticMarkup(<QuestionPrompt question={q} number={3} scenarioConcepts={["Queues", "Latency"]} />);
    return markup.match(/<h1 class="([^"]*)"/)?.[1].split(" ") ?? [];
  }

  it("sets a scenario at a smaller, readable size within a prose measure", () => {
    const classes = headingClass(question("scenario"));

    expect(classes).toEqual(expect.arrayContaining(["font-serif", "text-base", "sm:text-lg", "max-w-prose"]));
    expect(classes).not.toContain("sm:text-[1.75rem]");
  });

  it("keeps recall at the large Question size", () => {
    const classes = headingClass(question("recall"));

    expect(classes).toEqual(expect.arrayContaining(["text-[1.375rem]", "sm:text-[1.75rem]"]));
    expect(classes).not.toContain("max-w-prose");
  });

  it("still labels a scenario with its number and the Concepts it combines, and shows the whole prompt", () => {
    const prompt = "A long setup. ".repeat(40).trim();
    const text = textOf(
      renderToStaticMarkup(
        <QuestionPrompt question={question("scenario", { prompt })} number={5} scenarioConcepts={["Queues", "Latency"]} />,
      ),
    );

    expect(text).toContain("Question 5");
    expect(text).toContain("Scenario combining Queues and Latency");
    expect(text).toContain(prompt);
  });
});
