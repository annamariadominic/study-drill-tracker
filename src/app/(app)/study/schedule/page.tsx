import { ReviewSchedule } from "@/components/study/review-schedule";
import { PageHeader } from "@/components/ui/page-header";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import { listStudiedConcepts } from "@/lib/syllabus/list-studied-concepts";
import { listScheduledReviews } from "@/lib/syllabus/review-schedule";

export default async function ReviewSchedulePage() {
  const studiedConcepts = await listStudiedConcepts(getSyllabusRepository());
  const scheduledReviews = listScheduledReviews(studiedConcepts);
  const renderedAt = new Date().toISOString();

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Study", href: "/study" }]}
        title="Review schedule"
        description="When each studied Concept comes back for review, in your time zone."
      />

      <ReviewSchedule reviews={scheduledReviews} now={renderedAt} hasStudiedConcepts={studiedConcepts.length > 0} />
    </>
  );
}
