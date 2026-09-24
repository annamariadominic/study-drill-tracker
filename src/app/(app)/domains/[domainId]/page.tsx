import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EditDisclosure } from "@/components/ui/disclosure";
import { EmptyState, InlineAlert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { AddRow, RowLink, RowList } from "@/components/ui/list";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export default async function DomainPage({
  params,
  searchParams,
}: {
  params: Promise<{ domainId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { domainId } = await params;
  const { error } = await searchParams;
  const repo = getSyllabusRepository();

  const [domain, subjects] = await Promise.all([
    repo.getDomain(domainId),
    repo.listSubjects(domainId),
  ]);
  if (!domain) {
    notFound();
  }

  return (
    <>
      <PageHeader crumbs={[{ label: "Syllabus", href: "/domains" }]} kicker="Domain" title={domain.name}>
        <EditDisclosure label="Rename Domain">
          <form method="post" action={`/api/domains/${domain.id}`} className="flex max-w-md gap-2">
            <label htmlFor="domain-name" className="sr-only">
              Domain name
            </label>
            <Input id="domain-name" name="name" defaultValue={domain.name} required className="flex-1" />
            <Button type="submit">Save</Button>
          </form>
        </EditDisclosure>
      </PageHeader>

      {error === "domain-name" ? <InlineAlert className="mb-6">Domain name can&apos;t be empty.</InlineAlert> : null}
      {error === "subject-name" ? <InlineAlert className="mb-6">Subject name can&apos;t be empty.</InlineAlert> : null}

      <section aria-labelledby="subjects-heading">
        <SectionHeading id="subjects-heading" count={subjects.length}>
          Subjects
        </SectionHeading>
        {subjects.length === 0 ? (
          <EmptyState title="No Subjects yet">
            A Subject is an area of study within {domain.name}, like System Design. Add one below.
          </EmptyState>
        ) : (
          <RowList>
            {subjects.map((subject) => (
              <RowLink key={subject.id} href={`/domains/${domain.id}/subjects/${subject.id}`}>
                {subject.name}
              </RowLink>
            ))}
          </RowList>
        )}

        <AddRow
          action={`/api/domains/${domain.id}/subjects`}
          label="New Subject"
          placeholder="e.g. System Design"
          buttonLabel="Add Subject"
        />
      </section>
    </>
  );
}
