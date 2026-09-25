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

export type Attempt = {
  id: string;
  questionId: string;
  submittedAnswer: string;
  confidence: Confidence;
  correctness: Correctness;
  gradedExplanation: string;
  /**
   * What a strong answer would have said, written by the grader for a recall
   * or scenario Question. null for a flashcard (the correct option is on the
   * Question) and for Attempts graded before reference answers existed.
   */
  referenceAnswer: string | null;
  createdAt: string;
};
