import { CalendarDays, List, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { ReviewSchedule, type ReviewScheduleView } from "@/components/study/review-schedule";
import { PageHeader } from "@/components/ui/page-header";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import { listStudiedConcepts } from "@/lib/syllabus/list-studied-concepts";
import { listScheduledReviews } from "@/lib/syllabus/review-schedule";
import { cn } from "@/lib/utils";

const VIEWS: { value: ReviewScheduleView; label: string; icon: LucideIcon; href: string }[] = [
  { value: "list", label: "List", icon: List, href: "/study/schedule" },
  { value: "calendar", label: "Calendar", icon: CalendarDays, href: "/study/schedule?view=calendar" },
];

export default async function ReviewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: viewParam } = await searchParams;
  const view: ReviewScheduleView = viewParam === "calendar" ? "calendar" : "list";
  const studiedConcepts = await listStudiedConcepts(getSyllabusRepository());
  const scheduledReviews = listScheduledReviews(studiedConcepts);
  const renderedAt = new Date().toISOString();

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Study", href: "/study" }]}
        title="Review schedule"
        description="When each studied Concept comes back for review, in your time zone."
        actions={
          <nav aria-label="Schedule view" className="flex gap-1">
            {VIEWS.map(({ value, label, icon: Icon, href }) => {
              const current = value === view;
              return (
                <Link
                  key={value}
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-control border px-3 text-xs font-medium transition-colors duration-150",
                    current
                      ? "border-accent bg-accent-wash text-accent-strong"
                      : "border-line text-muted hover:border-line-strong hover:bg-surface hover:text-text",
                  )}
                >
                  <Icon aria-hidden className="size-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        }
      />

      <ReviewSchedule
        reviews={scheduledReviews}
        now={renderedAt}
        hasStudiedConcepts={studiedConcepts.length > 0}
        view={view}
      />
    </>
  );
}
