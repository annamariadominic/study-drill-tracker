/** Recall and flashcard Questions ask about one Concept; a scenario combines several. */
export type SingleConceptQuestionType = "recall" | "flashcard";
export type QuestionType = SingleConceptQuestionType | "scenario";
/** The Question types answered in the learner's own words and graded by the LLM. */
export type FreeTextQuestionType = Exclude<QuestionType, "flashcard">;
export type Correctness = "correct" | "partial" | "incorrect";
export type Confidence = "guessed" | "partial" | "confident";

export type Question = {
  id: string;
  /**
   * The Concepts the Question asks about, in the order it presents them:
   * exactly one for recall and flashcard, two or more for a scenario (see
   * assertQuestionConcepts).
   */
  conceptIds: string[];
  /** null for a one-off Question asked outside a Drill. */
  drillId: string | null;
  /** Zero-based order within the Drill; null outside a Drill. */
  position: number | null;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  correctOptionIndex: number | null;
  createdAt: string;
};

/**
 * Where an Attempt's grade has got to. A flashcard is graded as it's recorded;
 * a recall or scenario answer is recorded as pending and graded by the LLM in
 * the background (ADR 0011), ending graded or, if grading fails, failed until
 * a retry succeeds.
 */
export type GradingStatus = "pending" | "graded" | "failed";

/** The outcome of grading an Attempt. */
export type AttemptGrade = {
  correctness: Correctness;
  gradedExplanation: string;
  /**
   * What a strong answer would have said, written by the grader for a recall
   * or scenario Question. null for a flashcard (the correct option is on the
   * Question) and for Attempts graded before reference answers existed.
   */
  referenceAnswer: string | null;
};

type AttemptBase = {
  id: string;
  questionId: string;
  submittedAnswer: string;
  confidence: Confidence;
  /**
   * The Concepts whose review schedule this Attempt advances once it's graded,
   * decided when it was submitted (ADR 0006). Empty for Attempts recorded
   * before the decision was stored, which were graded and applied at once.
   */
  advancesConceptIds: string[];
  /** When grading last started: at submission, or on a retry. */
  gradingStartedAt: string;
  createdAt: string;
};

export type GradedAttempt = AttemptBase & { gradingStatus: "graded" } & AttemptGrade;

/** An Attempt still waiting on its grade, or whose grading failed. */
export type UngradedAttempt = AttemptBase & {
  gradingStatus: "pending" | "failed";
  correctness: null;
  gradedExplanation: null;
  referenceAnswer: null;
};

export type Attempt = GradedAttempt | UngradedAttempt;
