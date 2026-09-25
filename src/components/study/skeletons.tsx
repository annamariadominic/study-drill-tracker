import { PageHeaderSkeleton } from "@/components/ui/page-header";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";
import { DrillShell } from "./drill";

/**
 * A Study page while its server work runs: its header's shape, then a few
 * rows. It sits inside the app shell, so the sidebar stays put. `header` says
 * which parts the page's header has, so the real one lands in the same place.
 */
export function StudyPageSkeleton({ header }: { header: Parameters<typeof PageHeaderSkeleton>[0] }) {
  return (
    <LoadingRegion>
      <PageHeaderSkeleton {...header} />
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

/** QuestionPrompt's shape, then the answer area: the "Question N · type" line and two lines of prompt. */
function QuestionSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full sm:h-10" />
          <Skeleton className="h-8 w-2/3 sm:h-10" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-panel" />
    </>
  );
}

/** A single question outside a Drill, laid out like its page: breadcrumb, prompt, answer. */
export function QuestionPageSkeleton() {
  return (
    <LoadingRegion className="flex max-w-2xl flex-col gap-10">
      <Skeleton className="h-(--text-xs--line-height) w-12" />
      <QuestionSkeleton />
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
        <QuestionSkeleton />
      </LoadingRegion>
    </DrillShell>
  );
}
