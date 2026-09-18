import Link from "next/link";
import { notFound } from "next/navigation";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export default async function SubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ domainId: string; subjectId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { domainId, subjectId } = await params;
  const { error } = await searchParams;
  const repo = getSyllabusRepository();

  const [domain, subject] = await Promise.all([
    repo.getDomain(domainId),
    repo.getSubject(subjectId),
  ]);
  if (!domain || !subject || subject.domainId !== domainId) {
    notFound();
  }

  const concepts = await repo.listConcepts(subjectId);

  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem" }}>
      <p>
        <Link href={`/domains/${domain.id}`}>&larr; {domain.name}</Link>
      </p>

      <h1>{subject.name}</h1>
      <form
        method="post"
        action={`/api/subjects/${subject.id}`}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input type="hidden" name="domainId" value={domain.id} />
        <input name="name" defaultValue={subject.name} required />
        <button type="submit">Rename</button>
      </form>
      {error === "subject-name" ? <p role="alert">Subject name can&apos;t be empty.</p> : null}

      <h2>Concepts</h2>
      {concepts.length === 0 ? (
        <p>No Concepts yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {concepts.map((concept) => (
            <li key={concept.id} style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
              <strong>{concept.name}</strong> — {concept.status}
              <form
                method="post"
                action={`/api/concepts/${concept.id}`}
                style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}
              >
                <input type="hidden" name="domainId" value={domain.id} />
                <input type="hidden" name="subjectId" value={subject.id} />
                <label>
                  Name
                  <input name="name" defaultValue={concept.name} required />
                </label>
                <label>
                  Notes
                  <textarea name="notes" defaultValue={concept.notes ?? ""} rows={3} />
                </label>
                <button type="submit">Save</button>
              </form>
              <form method="post" action={`/api/concepts/${concept.id}/status`} style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="domainId" value={domain.id} />
                <input type="hidden" name="subjectId" value={subject.id} />
                <input
                  type="hidden"
                  name="status"
                  value={concept.status === "studied" ? "planned" : "studied"}
                />
                <button type="submit">
                  {concept.status === "studied" ? "Mark as planned" : "Mark as studied"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h3>New Concept</h3>
      <form
        method="post"
        action={`/api/subjects/${subject.id}/concepts`}
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      >
        <input type="hidden" name="domainId" value={domain.id} />
        <label>
          Name
          <input name="name" placeholder="e.g. Idempotency" required />
        </label>
        <label>
          Notes (optional)
          <textarea name="notes" rows={3} />
        </label>
        <button type="submit">Create</button>
      </form>
      {error === "concept-name" ? <p role="alert">Concept name can&apos;t be empty.</p> : null}
    </main>
  );
}
