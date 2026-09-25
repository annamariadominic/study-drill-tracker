import { StudyPageSkeleton } from "@/components/study/skeletons";

export default function Loading() {
  return <StudyPageSkeleton header={{ crumbs: true, description: true }} />;
}
