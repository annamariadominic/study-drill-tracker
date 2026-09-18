import Link from "next/link";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import { listDueConcepts } from "@/lib/syllabus/list-due-concepts";

export default async function DueConceptsPage() {
  const dueConcepts = await listDueConcepts(getSyllabusRepository());

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <p>
        <Link href="/study">&larr; Study</Link>
      </p>

      <h1>Due for review</h1>

      {dueConcepts.length === 0 ? (
        <p>Nothing is due right now. Check back later.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {dueConcepts.map(({ concept, subject, domain }) => (
            <li key={concept.id} style={{ border: "1px solid #ccc", padding: "0.75rem" }}>
              <strong>{concept.name}</strong>
              <p style={{ margin: "0.25rem 0", color: "#666" }}>
                {domain.name} / {subject.name}
              </p>
              <Link href="/study">Review a Concept</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
