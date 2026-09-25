import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { DrillShell } from "./drill";

/**
 * A Study page while its server work runs: the page header's shape, then a
 * few rows. It sits inside the app shell, so the sidebar stays put.
 */
export function StudyPageSkeleton() {
  return (
    <LoadingRegion>
      {/* The same box as PageHeader: breadcrumb line, serif title line, description line. */}
      <div className="mb-10 flex flex-col gap-3">
        <Skeleton className="h-5 w-12" />
        <div>
          <Skeleton className="h-[2.6rem] w-56 max-w-full" />
          <Skeleton className="mt-2 h-6 w-full max-w-md" />
        </div>
      </div>
      <div className="flex flex-col divide-y divide-line border-y border-line">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex flex-col gap-2 py-5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-full max-w-sm" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** A Drill question on its way, inside the Drill's own frame rather than the app shell. */
export function DrillSkeleton() {
  return (
    <DrillShell
      exit={<Skeleton className="h-5 w-12 sm:w-32" />}
      progress={<Skeleton className="h-5 w-40 sm:w-56" />}
    >
      <LoadingRegion className="flex flex-col gap-10">
        {/* QuestionPrompt's shape: the "Question N · type" line, then the prompt. */}
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-32" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-full sm:h-10" />
            <Skeleton className="h-8 w-2/3 sm:h-10" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-panel" />
      </LoadingRegion>
    </DrillShell>
  );
}
