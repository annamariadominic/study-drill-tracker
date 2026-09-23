import { describe, expect, it } from "vitest";
import type { ReviewScheduleState } from "@/lib/study/scheduling";
import { DEFAULT_MAX_QUESTIONS, composeDueDrill, conceptStrength } from "./compose-drill";
import type { DrillCandidate } from "./compose-drill";

const DUE_AT = "2026-01-01T00:00:00.000Z";

function schedule(
  intervalDays: number,
  easeFactor: number,
  nextDueAt: string = DUE_AT,
): ReviewScheduleState {
  return { intervalDays, easeFactor, nextDueAt };
}

function candidate(overrides: Partial<DrillCandidate> & { conceptId: string }): DrillCandidate {
  return {
    domainId: "domain-1",
    schedule: schedule(10, 2.5),
    ...overrides,
  };
}

const newlyStudied = schedule(1, 2.5);
const struggling = schedule(1, 1.9);
const developing = schedule(6, 2.6);
const strong = schedule(40, 2.8);

describe("conceptStrength", () => {
  it("treats a Concept with no review schedule as weak", () => {
    expect(conceptStrength(null)).toBe("weak");
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
      candidates: [candidate({ conceptId: "weak-1", schedule: newlyStudied })],
    });

    expect(questions).toEqual([
      { conceptIds: ["weak-1"], type: "recall" },
      { conceptIds: ["weak-1"], type: "flashcard" },
    ]);
  });

  it("gives a developing Concept a single recall Question and a strong one a single flashcard", () => {
    const questions = composeDueDrill({
      domainId: "domain-1",
      candidates: [
        candidate({ conceptId: "developing-1", schedule: developing }),
        candidate({ conceptId: "strong-1", schedule: strong }),
      ],
    });

    expect(questions).toEqual([
      { conceptIds: ["developing-1"], type: "recall" },
      { conceptIds: ["strong-1"], type: "flashcard" },
    ]);
  });

  it("weights weaker Concepts more heavily than stronger ones", () => {
    const questions = composeDueDrill({
      domainId: "domain-1",
      candidates: [
        candidate({ conceptId: "strong-1", schedule: strong }),
        candidate({ conceptId: "developing-1", schedule: developing }),
        candidate({ conceptId: "weak-1", schedule: newlyStudied }),
      ],
    });

    const countFor = (conceptId: string) =>
      questions.filter((question) => question.conceptIds[0] === conceptId).length;

    expect(countFor("weak-1")).toBeGreaterThan(countFor("developing-1"));
    expect(countFor("developing-1")).toBeGreaterThanOrEqual(countFor("strong-1"));
    expect(questions[0].conceptIds).toEqual(["weak-1"]);
  });

  it("never selects Concepts from another Domain", () => {
    const questions = composeDueDrill({
      domainId: "domain-1",
      candidates: [
        candidate({ conceptId: "other-domain", domainId: "domain-2", schedule: newlyStudied }),
        candidate({ conceptId: "in-domain", schedule: developing }),
      ],
    });

    expect(questions.map((question) => question.conceptIds[0])).toEqual(["in-domain"]);
  });

  it("caps the Drill at the maximum number of Questions", () => {
    const candidates = Array.from({ length: 20 }, (_, index) =>
      candidate({ conceptId: `concept-${index}`, schedule: newlyStudied }),
    );

    const questions = composeDueDrill({ domainId: "domain-1", candidates });

    expect(questions).toHaveLength(DEFAULT_MAX_QUESTIONS);
  });

  it("honours an explicit cap and never splits a Concept's Questions across it", () => {
    const candidates = [
      candidate({ conceptId: "weak-1", schedule: newlyStudied }),
      candidate({ conceptId: "weak-2", schedule: newlyStudied }),
    ];

    const questions = composeDueDrill({ domainId: "domain-1", candidates, maxQuestions: 3 });

    expect(questions).toEqual([
      { conceptIds: ["weak-1"], type: "recall" },
      { conceptIds: ["weak-1"], type: "flashcard" },
    ]);
  });

  it("orders equally-weak Concepts by how long they have been due", () => {
    const questions = composeDueDrill({
      domainId: "domain-1",
      candidates: [
        candidate({ conceptId: "later", schedule: schedule(6, 2.6, "2026-01-02T00:00:00.000Z") }),
        candidate({ conceptId: "earlier", schedule: schedule(6, 2.6, "2026-01-01T00:00:00.000Z") }),
      ],
    });

    expect(questions.map((question) => question.conceptIds[0])).toEqual(["earlier", "later"]);
  });

  it("returns no Questions when nothing in the Domain is due", () => {
    expect(composeDueDrill({ domainId: "domain-1", candidates: [] })).toEqual([]);
  });
});
