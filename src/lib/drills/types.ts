/**
 * Only due-scoped Drills exist so far; the ad-hoc scopes described in
 * CONTEXT.md (library, Subject, hand-picked Concepts) aren't built yet.
 */
export type DrillScope = "due";

export type Drill = {
  id: string;
  domainId: string;
  scope: DrillScope;
  scopeDetail: Record<string, unknown> | null;
  createdAt: string;
};
