export type QuestionType = "recall" | "flashcard";
export type Correctness = "correct" | "partial" | "incorrect";
export type Confidence = "guessed" | "partial" | "confident";

export type Question = {
  id: string;
  conceptId: string;
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
