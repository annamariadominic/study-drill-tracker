import { Shuffle } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, InlineAlert } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { PendingSubmit } from "@/components/ui/pending-submit";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import { listDueConcepts, type DueConcept } from "@/lib/syllabus/list-due-concepts";

/**
 * A Drill stays within one Domain (ADR 0001), so the due-list is grouped by
 * Domain and each group starts its own Drill.
 */
function groupByDomain(dueConcepts: DueConcept[]) {
  const groups = new Map<string, { name: string; dueConcepts: DueConcept[] }>();
  for (const dueConcept of dueConcepts) {
    const group = groups.get(dueConcept.domain.id) ?? {
      name: dueConcept.domain.name,
      dueConcepts: [],
    };
    group.dueConcepts.push(dueConcept);
    groups.set(dueConcept.domain.id, group);
  }
  return [...groups.entries()];
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export default async function DueConceptsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const dueConcepts = await listDueConcepts(getSyllabusRepository());
  const domains = groupByDomain(dueConcepts);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Study", href: "/study" }]}
        title="Due for review"
        description={
          domains.length > 0
            ? `${plural(dueConcepts.length, "Concept")} due across ${plural(domains.length, "Domain")}. A Drill stays within one Domain, so each starts its own.`
            : undefined
        }
      />

      {error === "drill-generation-failed" ? (
        <InlineAlert className="mb-8">Couldn&apos;t generate a Drill right now. Try again.</InlineAlert>
      ) : null}
      {error === "nothing-due" ? (
        <InlineAlert className="mb-8">Nothing is due in that Domain any more.</InlineAlert>
      ) : null}

      {domains.length === 0 ? (
        <EmptyState
          title="Nothing is due right now"
          action={
            <Link href="/study/random" className={buttonVariants({ variant: "secondary" })}>
              <Shuffle aria-hidden />
              Start a random Drill
            </Link>
          }
        >
          Your review schedule will bring Concepts back when it&apos;s time. You can still drill in the meantime.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-12">
          {domains.map(([domainId, group]) => (
            <section key={domainId} aria-labelledby={`due-${domainId}`}>
              <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id={`due-${domainId}`} className="font-serif text-xl text-text">
                    {group.name}
                  </h2>
                  <p className="text-sm text-muted">{plural(group.dueConcepts.length, "Concept")} due</p>
                </div>
                <form method="post" action="/api/drills">
                  <input type="hidden" name="domainId" value={domainId} />
                  <PendingSubmit pendingLabel="Generating Drill…">Start Drill</PendingSubmit>
                </form>
              </div>

              <ul className="divide-y divide-line">
                {group.dueConcepts.map(({ concept, subject }) => (
                  <li
                    key={concept.id}
                    className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                  >
                    <span className="text-text">{concept.name}</span>
                    <span className="shrink-0 text-xs text-muted">{subject.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
