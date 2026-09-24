export type ConceptStatus = "planned" | "studied";

export type Domain = {
  id: string;
  name: string;
  createdAt: string;
};

export type Subject = {
  id: string;
  domainId: string;
  name: string;
  /** 0-based place in its Domain's manually ordered Subject list. */
  position: number;
  createdAt: string;
};

export type Concept = {
  id: string;
  subjectId: string;
  name: string;
  notes: string | null;
  /** 0-based place in its Subject's manually ordered Concept list. */
  position: number;
  status: ConceptStatus;
  studiedAt: string | null;
  createdAt: string;
  reviewIntervalDays: number | null;
  reviewEaseFactor: number | null;
  nextReviewDueAt: string | null;
};
