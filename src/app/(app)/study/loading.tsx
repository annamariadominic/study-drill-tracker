import { StudyPageSkeleton } from "@/components/study/skeletons";

/**
 * Shown at once when a link opens a Study page, while its queries run. The app
 * shell's layout is shared, so the sidebar stays in place around it. Each
 * Study page below has its own, shaped like its header.
 */
export default function StudyLoading() {
  return <StudyPageSkeleton header={{ description: true }} />;
}
