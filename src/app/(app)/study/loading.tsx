import { StudyPageSkeleton } from "@/components/study/loading";

/**
 * Shown at once when a link opens another Study page, while its queries run.
 * The app shell's layout is shared, so the sidebar stays in place around it.
 */
export default function StudyLoading() {
  return <StudyPageSkeleton />;
}
