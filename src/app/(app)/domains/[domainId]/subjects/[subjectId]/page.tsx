import { Check, Undo2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EditDisclosure } from "@/components/ui/disclosure";
import { EmptyState, InlineAlert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { RowList } from "@/components/ui/list";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { SortableList } from "@/components/ui/sortable-list";
import { ConceptStatusMark } from "@/components/ui/status";
import { filterConcepts, parseConceptFilter } from "@/lib/syllabus/concept-filter";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import type { Concept, ConceptStatus } from "@/lib/syllabus/types";
import { cn } from "@/lib/utils";

const FILTERS: { value: ConceptStatus | undefined; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "studied", label: "Studied" },
  { value: "planned", label: "Planned" },
];

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ domainId: string; subjectId: string }>;
  searchParams: Promise<{ error?: string; show?: string }>;
}) {
  const { domainId, subjectId } = await params;
  const { error, show: showParam } = await searchParams;
  const show = parseConceptFilter(showParam);
  const repo = getSyllabusRepository();

  const [domain, subject] = await Promise.all([
    repo.getDomain(domainId),
    repo.getSubject(subjectId),
  ]);
  if (!domain || !subject || subject.domainId !== domainId) {
    notFound();
  }

  const concepts = await repo.listConcepts(subjectId);
  const studiedCount = concepts.filter((concept) => concept.status === "studied").length;
  const shown = filterConcepts(concepts, show);
  const subjectHref = `/domains/${domain.id}/subjects/${subject.id}`;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Syllabus", href: "/domains" },
          { label: domain.name, href: `/domains/${domain.id}` },
        ]}
        kicker="Subject"
        title={subject.name}
        description={
          concepts.length > 0
            ? `${studiedCount} of ${concepts.length} Concepts studied. Only studied Concepts are reviewed in Drills.`
            : undefined
        }
      >
        <EditDisclosure label="Rename Subject">
          <form method="post" action={`/api/subjects/${subject.id}`} className="flex max-w-md gap-2">
            <input type="hidden" name="domainId" value={domain.id} />
            <label htmlFor="subject-name" className="sr-only">
              Subject name
            </label>
            <Input id="subject-name" name="name" defaultValue={subject.name} required className="flex-1" />
            <Button type="submit">Save</Button>
          </form>
        </EditDisclosure>
      </PageHeader>

      {error === "subject-name" ? <InlineAlert className="mb-6">Subject name can&apos;t be empty.</InlineAlert> : null}
      {error === "concept-name" ? <InlineAlert className="mb-6">Concept name can&apos;t be empty.</InlineAlert> : null}

      <section aria-labelledby="concepts-heading">
        <SectionHeading
          id="concepts-heading"
          count={concepts.length}
          trailing={
            concepts.length > 0 ? (
              <nav aria-label="Filter Concepts" className="flex gap-1">
                {FILTERS.map(({ value, label }) => (
                  <Link
                    key={label}
                    href={value ? `${subjectHref}?show=${value}` : subjectHref}
                    aria-current={show === value ? "true" : undefined}
                    className={cn(
                      "rounded-control px-2 py-0.5 text-xs transition-colors",
                      show === value ? "bg-surface text-text" : "text-muted hover:text-text",
                    )}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            ) : null
          }
        >
          Concepts
        </SectionHeading>

        {concepts.length === 0 ? (
          <EmptyState title="No Concepts yet">
            A Concept is one thing to learn, like idempotency. Add it below, then mark it studied once you&apos;ve
            learned it.
          </EmptyState>
        ) : shown.length === 0 ? (
          <p className="py-6 text-sm text-muted">No {show} Concepts in this Subject.</p>
        ) : show ? (
          // Reordering needs the whole list: a filtered view can't place the Concepts it hides.
          <>
            {concepts.length > 1 ? (
              <p className="mb-3 text-xs text-muted">
                To reorder Concepts, show{" "}
                <Link href={subjectHref} className="text-accent underline-offset-4 hover:underline">
                  All
                </Link>
                .
              </p>
            ) : null}
            <RowList>
              {shown.map((concept) => (
                <li key={concept.id}>
                  <ConceptRow concept={concept} domainId={domain.id} subjectId={subject.id} show={show} />
                </li>
              ))}
            </RowList>
          </>
        ) : (
          <SortableList
            saveUrl={`/api/subjects/${subject.id}/concepts/order`}
            idsKey="conceptIds"
            itemClassName="items-start"
            handleClassName="mt-3.5"
            items={shown.map((concept) => ({
              id: concept.id,
              label: concept.name,
              content: <ConceptRow concept={concept} domainId={domain.id} subjectId={subject.id} />,
            }))}
          />
        )}

        <form
          method="post"
          action={`/api/subjects/${subject.id}/concepts`}
          className="mt-10 flex max-w-lg flex-col gap-4"
        >
          <h3 className="text-sm font-semibold text-text">New Concept</h3>
          <input type="hidden" name="domainId" value={domain.id} />
          <Field label="Name" htmlFor="new-concept-name">
            <Input id="new-concept-name" name="name" placeholder="e.g. Idempotency" required />
          </Field>
          <Field label="Notes" htmlFor="new-concept-notes" hint="Optional. You can add or enrich notes later.">
            <Textarea id="new-concept-notes" name="notes" rows={3} />
          </Field>
          <div>
            <Button type="submit" variant="secondary">
              Add Concept
            </Button>
          </div>
        </form>
      </section>
    </>
  );
}

/** One Concept's row: status, name and notes, the studied/planned toggle, and its edit form. */
function ConceptRow({
  concept,
  domainId,
  subjectId,
  show,
}: {
  concept: Concept;
  domainId: string;
  subjectId: string;
  /** The active filter, kept across the status toggle's redirect. */
  show?: ConceptStatus;
}) {
  const studied = concept.status === "studied";
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <span className="pt-2">
        <ConceptStatusMark status={concept.status} />
      </span>
      <div className="col-start-2 row-start-1 min-w-0">
        <p className={cn("font-serif text-lg", studied ? "text-text" : "text-muted")}>{concept.name}</p>
        {concept.notes ? (
          <p className="mt-0.5 line-clamp-2 max-w-prose text-sm whitespace-pre-line text-muted">
            {concept.notes}
          </p>
        ) : null}
      </div>
      <form
        method="post"
        action={`/api/concepts/${concept.id}/status`}
        className="col-start-2 row-start-2 -ml-3 pt-1 sm:col-start-3 sm:row-start-1 sm:ml-0 sm:pt-0"
      >
        <input type="hidden" name="domainId" value={domainId} />
        <input type="hidden" name="subjectId" value={subjectId} />
        <input type="hidden" name="status" value={studied ? "planned" : "studied"} />
        {show ? <input type="hidden" name="show" value={show} /> : null}
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          className={studied ? undefined : "text-accent hover:text-accent-strong"}
        >
          {studied ? <Undo2 aria-hidden /> : <Check aria-hidden />}
          {studied ? "Mark as planned" : "Mark as studied"}
        </Button>
      </form>
      <EditDisclosure label="Edit" className="col-start-2 row-start-3 sm:row-start-2 sm:mt-1">
        <form
          method="post"
          action={`/api/concepts/${concept.id}`}
          className="flex max-w-lg flex-col gap-4 pb-2"
        >
          <input type="hidden" name="domainId" value={domainId} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <Field label="Name" htmlFor={`concept-${concept.id}-name`}>
            <Input id={`concept-${concept.id}-name`} name="name" defaultValue={concept.name} required />
          </Field>
          <Field label="Notes" htmlFor={`concept-${concept.id}-notes`}>
            <Textarea
              id={`concept-${concept.id}-notes`}
              name="notes"
              defaultValue={concept.notes ?? ""}
              rows={4}
            />
          </Field>
          <div>
            <Button type="submit">Save changes</Button>
          </div>
        </form>
      </EditDisclosure>
    </div>
  );
}
