import { DrillSkeleton } from "@/components/study/skeletons";

/**
 * Shown while a Drill loads, e.g. streamed first after a Drill is started.
 * "Next question" stays on this route and only drops the search params, which
 * doesn't re-show this fallback; it's a PendingLink instead.
 */
export default function DrillLoading() {
  return <DrillSkeleton />;
}
