import { CalendarClock, ChevronRight, Shuffle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Choice, ChoiceGroup } from "@/components/ui/choice";
import { EmptyState, InlineAlert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { PendingSubmit } from "@/components/ui/pending-submit";
import { buttonVariants } from "@/components/ui/button";
import { ReviewSchedule } from "@/components/study/review-schedule";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import { listStudiedConcepts, type StudiedConcept } from "@/lib/syllabus/list-studied-concepts";
import { listScheduledReviews } from "@/lib/syllabus/review-schedule";

/** Studied Concepts grouped as "Domain › Subject" for the picker's <optgroup>s, in listed order. */
function groupForPicker(studiedConcepts: StudiedConcept[]) {
  const groups = new Map<string, { label: string; concepts: StudiedConcept["concept"][] }>();
  for (const { domain, subject, concept } of studiedConcepts) {
    const group = groups.get(subject.id) ?? { label: `${domain.name} › ${subject.name}`, concepts: [] };
    group.concepts.push(concept);
    groups.set(subject.id, group);
  }
  return [...groups.entries()];
}

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const studiedConcepts = await listStudiedConcepts(getSyllabusRepository());
  const scheduledReviews = listScheduledReviews(studiedConcepts);
  const renderedAt = new Date().toISOString();

  return (
    <>
      <PageHeader title="Study" description="Review what's due, drill whenever you like, or test yourself on one Concept." />

      <div className="grid border-y border-line sm:grid-cols-2 sm:divide-x sm:divide-line">
        <StudyRoute
          href="/study/due"
          icon={CalendarClock}
          title="Due for review"
          className="border-b border-line sm:border-b-0 sm:pr-8"
        >
          Concepts your review schedule says are ready. Each Domain gets its own Drill.
        </StudyRoute>
        <StudyRoute href="/study/random" icon={Shuffle} title="Random Drill" className="sm:pl-8">
          Drill any time: your whole library, one Subject, or Concepts you pick.
        </StudyRoute>
      </div>

      <section aria-labelledby="single-question-heading" className="mt-14">
        <SectionHeading id="single-question-heading">Ask a single question</SectionHeading>
        <p className="mb-6 max-w-prose text-sm text-muted">
          One question on one Concept, outside a Drill. Your answer still counts toward that Concept&apos;s review
          schedule.
        </p>

        {error === "generation-failed" ? (
          <InlineAlert className="mb-6">Couldn&apos;t generate a question right now. Try again.</InlineAlert>
        ) : null}

        {studiedConcepts.length === 0 ? (
          <EmptyState
            title="Nothing studied yet"
            action={
              <Link href="/domains" className={buttonVariants({ variant: "secondary" })}>
                Open your syllabus
              </Link>
            }
          >
            Mark a Concept as studied on its Subject page, and it becomes available to question and drill.
          </EmptyState>
        ) : (
          <form method="post" action="/api/questions" className="flex max-w-xl flex-col gap-6">
            <Field label="Concept" htmlFor="concept">
              <NativeSelect id="concept" name="conceptId" required>
                {groupForPicker(studiedConcepts).map(([subjectId, group]) => (
                  <optgroup key={subjectId} label={group.label}>
                    {group.concepts.map((concept) => (
                      <option key={concept.id} value={concept.id}>
                        {concept.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </NativeSelect>
            </Field>

            <ChoiceGroup legend="Question type" className="[&>div]:sm:grid [&>div]:sm:grid-cols-2">
              <Choice name="type" value="recall" defaultChecked required description="Explain it in your own words.">
                Recall
              </Choice>
              <Choice name="type" value="flashcard" required description="Choose the right answer from a few options.">
                Flashcard
              </Choice>
            </ChoiceGroup>

            <div>
              <PendingSubmit pendingLabel="Writing your question…">Ask a question</PendingSubmit>
            </div>
          </form>
        )}
      </section>

      <section aria-labelledby="review-schedule-heading" className="mt-14">
        <SectionHeading id="review-schedule-heading" count={scheduledReviews.length}>
          Review schedule
        </SectionHeading>
        <p className="mb-6 max-w-prose text-sm text-muted">
          When each studied Concept comes back for review, in your time zone.
        </p>
        <ReviewSchedule
          reviews={scheduledReviews}
          now={renderedAt}
          hasStudiedConcepts={studiedConcepts.length > 0}
        />
      </section>
    </>
  );
}

function StudyRoute({
  href,
  icon: Icon,
  title,
  className,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-2 py-7 transition-colors duration-150 ${className ?? ""}`}
    >
      <Icon aria-hidden className="size-5 text-accent" />
      <span className="flex items-center gap-1.5 font-serif text-xl text-text">
        {title}
        <ChevronRight
          aria-hidden
          className="size-4 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent"
        />
      </span>
      <span className="max-w-xs text-sm text-muted">{children}</span>
    </Link>
  );
}
