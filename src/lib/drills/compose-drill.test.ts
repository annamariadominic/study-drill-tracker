import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_QUESTIONS, composeDueDrill, conceptStrength } from "./compose-drill";
import type { DrillCandidate } from "./compose-drill";

function candidate(overrides: Partial<DrillCandidate> & { conceptId: string }): DrillCandidate {
  return {
    domainId: "domain-1",
    reviewIntervalDays: 10,
    reviewEaseFactor: 2.5,
    dueAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const newlyStudied = { reviewIntervalDays: 1, reviewEaseFactor: 2.5 };
const struggling = { reviewIntervalDays: 1, reviewEaseFactor: 1.9 };
const developing = { reviewIntervalDays: 6, reviewEaseFactor: 2.6 };
const strong = { reviewIntervalDays: 40, reviewEaseFactor: 2.8 };

describe("conceptStrength", () => {
  it("treats a Concept with no review schedule as weak", () => {
    expect(conceptStrength({ reviewIntervalDays: null, reviewEaseFactor: null })).toBe("weak");
  });

  it("treats a newly-studied Concept as weak", () => {
    expect(conceptStrength(newlyStudied)).toBe("weak");
  });

  it("treats a Concept that keeps being got wrong as weak", () => {
    expect(conceptStrength(struggling)).toBe("weak");
  });

  it("treats a Concept with a growing interval as developing", () => {
    expect(conceptStrength(developing)).toBe("developing");
  });

  it("treats a Concept with a long interval as strong", () => {
    expect(conceptStrength(strong)).toBe("strong");
  });
});

describe("composeDueDrill", () => {
  it("gives weak Concepts both a recall and a flashcard Question", () => {
    const questions = composeDueDrill({
      domainId: "domain-1",
      candidates: [candidate({ conceptId: "weak-1", ...newlyStudied })],
    });

    expect(questions).toEqual([
      { conceptId: "weak-1", type: "recall" },
      { conceptId: "weak-1", type: "flashcard" },
    ]);
  });

  it("gives a developing Concept a single recall Question and a strong one a single flashcard", () => {
    const questions = composeDueDrill({
      domainId: "domain-1",
      candidates: [
        candidate({ conceptId: "developing-1", ...developing }),
        candidate({ conceptId: "strong-1", ...strong }),
      ],
    });

    expect(questions).toEqual([
      { conceptId: "developing-1", type: "recall" },
      { conceptId: "strong-1", type: "flashcard" },
    ]);
  });

  it("weights weaker Concepts more heavily than stronger ones", () => {
    const questions = composeDueDrill({
      domainId: "domain-1",
      candidates: [
        candidate({ conceptId: "strong-1", ...strong }),
        candidate({ conceptId: "developing-1", ...developing }),
        candidate({ conceptId: "weak-1", ...newlyStudied }),
      ],
    });

    const countFor = (conceptId: string) =>
      questions.filter((question) => question.conceptId === conceptId).length;

    expect(countFor("weak-1")).toBeGreaterThan(countFor("developing-1"));
    expect(countFor("developing-1")).toBeGreaterThanOrEqual(countFor("strong-1"));
    expect(questions[0].conceptId).toBe("weak-1");
  });

  it("never selects Concepts from another Domain", () => {
    const questions = composeDueDrill({
      domainId: "domain-1",
      candidates: [
        candidate({ conceptId: "other-domain", domainId: "domain-2", ...newlyStudied }),
        candidate({ conceptId: "in-domain", ...developing }),
      ],
    });

    expect(questions.map((question) => question.conceptId)).toEqual(["in-domain"]);
  });

  it("caps the Drill at the maximum number of Questions", () => {
    const candidates = Array.from({ length: 20 }, (_, index) =>
      candidate({ conceptId: `concept-${index}`, ...newlyStudied }),
    );

    const questions = composeDueDrill({ domainId: "domain-1", candidates });

    expect(questions).toHaveLength(DEFAULT_MAX_QUESTIONS);
  });

  it("honours an explicit cap and never splits a Concept's Questions across it", () => {
    const candidates = [
      candidate({ conceptId: "weak-1", ...newlyStudied }),
      candidate({ conceptId: "weak-2", ...newlyStudied }),
    ];

    const questions = composeDueDrill({ domainId: "domain-1", candidates, maxQuestions: 3 });

    expect(questions).toEqual([
      { conceptId: "weak-1", type: "recall" },
      { conceptId: "weak-1", type: "flashcard" },
    ]);
  });

  it("orders equally-weak Concepts by how long they have been due", () => {
    const questions = composeDueDrill({
      domainId: "domain-1",
      candidates: [
        candidate({ conceptId: "later", ...developing, dueAt: "2026-01-02T00:00:00.000Z" }),
        candidate({ conceptId: "earlier", ...developing, dueAt: "2026-01-01T00:00:00.000Z" }),
      ],
    });

    expect(questions.map((question) => question.conceptId)).toEqual(["earlier", "later"]);
  });

  it("returns no Questions when nothing in the Domain is due", () => {
    expect(composeDueDrill({ domainId: "domain-1", candidates: [] })).toEqual([]);
  });
});
