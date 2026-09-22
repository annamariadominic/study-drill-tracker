export type QuestionType = "recall" | "flashcard";
export type Correctness = "correct" | "partial" | "incorrect";
export type Confidence = "guessed" | "partial" | "confident";

export type Question = {
  id: string;
  conceptId: string;
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
  createdAt: string;
};
