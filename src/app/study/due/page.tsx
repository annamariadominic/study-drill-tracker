import Link from "next/link";
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

export default async function DueConceptsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const dueConcepts = await listDueConcepts(getSyllabusRepository());
  const domains = groupByDomain(dueConcepts);

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <p>
        <Link href="/study">&larr; Study</Link>
      </p>

      <h1>Due for review</h1>

      {error === "drill-generation-failed" ? (
        <p role="alert">Couldn&apos;t generate a Drill right now. Please try again.</p>
      ) : null}
      {error === "nothing-due" ? (
        <p role="alert">Nothing is due in that Domain any more.</p>
      ) : null}

      {domains.length === 0 ? (
        <p>
          Nothing is due right now. Check back later, or{" "}
          <Link href="/study/random">start a random Drill</Link>.
        </p>
      ) : (
        domains.map(([domainId, group]) => (
          <section key={domainId} style={{ marginBottom: "2rem" }}>
            <h2>{group.name}</h2>

            <form method="post" action="/api/drills">
              <input type="hidden" name="domainId" value={domainId} />
              <button type="submit">Start a Drill ({group.dueConcepts.length} due)</button>
            </form>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                marginTop: "1rem",
              }}
            >
              {group.dueConcepts.map(({ concept, subject }) => (
                <li key={concept.id} style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
                  <strong>{concept.name}</strong>
                  <p style={{ margin: "0.25rem 0", color: "#666" }}>{subject.name}</p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
