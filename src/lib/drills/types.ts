/**
 * A Drill is drawn either from the due-list or at random on demand, scoped to
 * the whole library, one Subject, or hand-picked Concepts (see RandomDrillScope).
 */
export type DrillScope = "due" | "random";

/** What a random Drill draws its Concepts from, stored as its scope detail. */
export type RandomDrillScope =
  | { kind: "library" }
  | { kind: "subject"; subjectId: string }
  | { kind: "concepts"; conceptIds: string[] };

export type Drill = {
  id: string;
  domainId: string;
  scope: DrillScope;
  scopeDetail: Record<string, unknown> | null;
  createdAt: string;
};
