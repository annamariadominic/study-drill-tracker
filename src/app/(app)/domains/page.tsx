import { EmptyState, InlineAlert } from "@/components/ui/feedback";
import { AddRow, RowLink, RowList } from "@/components/ui/list";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const domains = await getSyllabusRepository().listDomains();

  return (
    <>
      <PageHeader
        title="Syllabus"
        description="Everything you're learning, organised as Domains, then Subjects, then the Concepts inside them."
      />

      {error === "domain-name" ? <InlineAlert className="mb-6">Domain name can&apos;t be empty.</InlineAlert> : null}

      <section aria-labelledby="domains-heading">
        <SectionHeading id="domains-heading" count={domains.length}>
          Domains
        </SectionHeading>
        {domains.length === 0 ? (
          <EmptyState title="No Domains yet">
            A Domain is the broadest grouping, like Software Engineering. Add your first one below.
          </EmptyState>
        ) : (
          <RowList>
            {domains.map((domain) => (
              <RowLink key={domain.id} href={`/domains/${domain.id}`}>
                {domain.name}
              </RowLink>
            ))}
          </RowList>
        )}

        <AddRow action="/api/domains" label="New Domain" placeholder="e.g. Software Engineering" buttonLabel="Add Domain" />
      </section>
    </>
  );
}
