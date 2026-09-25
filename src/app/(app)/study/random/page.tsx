import Link from "next/link";
import { Choice } from "@/components/ui/choice";
import { EmptyState, InlineAlert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PendingSubmit } from "@/components/ui/pending-submit";
import { buttonVariants } from "@/components/ui/button";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import type { StudiedConcept } from "@/lib/syllabus/types";
import { cn } from "@/lib/utils";

const ERRORS: Record<string, string> = {
  "drill-generation-failed": "Couldn't generate a Drill right now. Try again.",
  "nothing-studied": "There's nothing studied to drill there yet.",
  "no-concepts-picked": "Pick at least one Concept to drill.",
  "scope-changed": "Something you picked has changed since this page loaded. Pick again.",
  "mixed-domains": "A Drill stays within one Domain, so pick Concepts from a single Domain.",
};

type Scope = "library" | "subject" | "concepts";

const SCOPES: { value: Scope; label: string; description: string }[] = [
  { value: "library", label: "Whole library", description: "Any studied Concepts, from one Domain picked at random." },
  { value: "subject", label: "One Subject", description: "Studied Concepts from a Subject you choose." },
  { value: "concepts", label: "Hand-picked", description: "Exactly the Concepts you tick, all from one Domain." },
];

type SubjectGroup = { id: string; name: string; studied: StudiedConcept[] };
type DomainGroup = { id: string; name: string; subjects: SubjectGroup[] };

/** The studied library as Domain > Subject > Concept, in the order it was listed. */
function groupLibrary(studiedConcepts: StudiedConcept[]): DomainGroup[] {
  const domains = new Map<string, DomainGroup>();
  for (const studied of studiedConcepts) {
    const domain = domains.get(studied.domain.id) ?? {
      id: studied.domain.id,
      name: studied.domain.name,
      subjects: [],
    };
    domains.set(domain.id, domain);
    let subject = domain.subjects.find(({ id }) => id === studied.subject.id);
    if (!subject) {
      subject = { id: studied.subject.id, name: studied.subject.name, studied: [] };
      domain.subjects.push(subject);
    }
    subject.studied.push(studied);
  }
  return [...domains.values()];
}

export default async function RandomDrillPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; scope?: string }>;
}) {
  const { error, scope: scopeParam } = await searchParams;
  // Errors come back with the scope they were submitted from, so they land on that form.
  const scope: Scope = SCOPES.some(({ value }) => value === scopeParam) ? (scopeParam as Scope) : "library";
  const library = groupLibrary(await getSyllabusRepository().listStudiedConcepts());

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Study", href: "/study" }]}
        title="Random Drill"
        description="Drill any time, whether or not anything is due. A Drill stays within one Domain."
      />

      {error && ERRORS[error] ? <InlineAlert className="mb-8">{ERRORS[error]}</InlineAlert> : null}

      {library.length === 0 ? (
        <EmptyState
          title="Nothing studied yet"
          action={
            <Link href="/domains" className={buttonVariants({ variant: "secondary" })}>
              Open your syllabus
            </Link>
          }
        >
          Mark a Concept as studied on its Subject page first, then come back to drill it.
        </EmptyState>
      ) : (
        <>
          <nav aria-label="What to drill" className="mb-8 grid gap-2 sm:grid-cols-3">
            {SCOPES.map(({ value, label, description }) => {
              const current = value === scope;
              return (
                <Link
                  key={value}
                  href={`/study/random?scope=${value}`}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-control border px-4 py-3 transition-colors duration-150",
                    current
                      ? "border-accent bg-accent-wash"
                      : "border-line hover:border-line-strong hover:bg-surface",
                  )}
                >
                  <span className={cn("text-sm font-medium", current ? "text-accent-strong" : "text-text")}>
                    {label}
                  </span>
                  <span className="text-xs text-muted">{description}</span>
                </Link>
              );
            })}
          </nav>

          {scope === "library" ? (
            <form method="post" action="/api/drills/random" className="flex flex-col items-start gap-4">
              <input type="hidden" name="kind" value="library" />
              <p className="max-w-prose text-sm text-muted">
                One of your Domains is picked at random, then the Drill draws from everything you&apos;ve studied in
                it.
              </p>
              <PendingSubmit pendingLabel="Generating Drill…">Start a random Drill</PendingSubmit>
            </form>
          ) : null}

          {scope === "subject" ? (
            <form method="post" action="/api/drills/random" className="flex max-w-xl flex-col gap-4">
              <input type="hidden" name="kind" value="subject" />
              <Field label="Subject" htmlFor="subject">
                <NativeSelect id="subject" name="subjectId" required>
                  {library.map((domain) => (
                    <optgroup key={domain.id} label={domain.name}>
                      {domain.subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name} ({subject.studied.length} studied)
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </NativeSelect>
              </Field>
              <div>
                <PendingSubmit pendingLabel="Generating Drill…">Drill this Subject</PendingSubmit>
              </div>
            </form>
          ) : null}

          {scope === "concepts" ? (
            <form method="post" action="/api/drills/random" className="flex flex-col gap-10">
              <input type="hidden" name="kind" value="concepts" />
              {library.map((domain) => (
                <fieldset key={domain.id} className="min-w-0">
                  <legend className="mb-4 w-full border-b border-line pb-2 font-serif text-xl text-text">
                    {domain.name}
                  </legend>
                  <div className="flex flex-col gap-6">
                    {domain.subjects.map((subject) => (
                      <div key={subject.id}>
                        <p className="mb-1 text-xs font-medium text-muted">{subject.name}</p>
                        <div className="-mx-3 grid gap-x-4 sm:grid-cols-2">
                          {subject.studied.map(({ concept }) => (
                            <Choice key={concept.id} type="checkbox" name="conceptId" value={concept.id} plain>
                              {concept.name}
                            </Choice>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}
              <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg/95 px-4 py-4 backdrop-blur-sm sm:mx-0 sm:px-0">
                <PendingSubmit pendingLabel="Generating Drill…">Drill these Concepts</PendingSubmit>
              </div>
            </form>
          ) : null}
        </>
      )}
    </>
  );
}
