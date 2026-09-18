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
  createdAt: string;
};

export type Concept = {
  id: string;
  subjectId: string;
  name: string;
  notes: string | null;
  status: ConceptStatus;
  studiedAt: string | null;
  createdAt: string;
  reviewIntervalDays: number | null;
  reviewEaseFactor: number | null;
  nextReviewDueAt: string | null;
};
