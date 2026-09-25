import { DrillSkeleton } from "@/components/study/loading";

/**
 * Shown while a Drill loads, e.g. streamed first after a Drill is started.
 * "Next question" stays on this route and only drops the search params, which
 * doesn't re-show this fallback; NextStepIcon covers that link instead.
 */
export default function DrillLoading() {
  return <DrillSkeleton />;
}
