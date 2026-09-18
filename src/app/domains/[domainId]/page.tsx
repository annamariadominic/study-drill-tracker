import Link from "next/link";
import { notFound } from "next/navigation";
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
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <p>
        <Link href="/domains">&larr; Domains</Link>
      </p>

      <h1>{domain.name}</h1>
      <form
        method="post"
        action={`/api/domains/${domain.id}`}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input name="name" defaultValue={domain.name} required />
        <button type="submit">Rename</button>
      </form>
      {error === "domain-name" ? <p role="alert">Domain name can&apos;t be empty.</p> : null}

      <h2>Subjects</h2>
      {subjects.length === 0 ? (
        <p>No Subjects yet.</p>
      ) : (
        <ul>
          {subjects.map((subject) => (
            <li key={subject.id}>
              <Link href={`/domains/${domain.id}/subjects/${subject.id}`}>{subject.name}</Link>
            </li>
          ))}
        </ul>
      )}

      <h3>New Subject</h3>
      <form
        method="post"
        action={`/api/domains/${domain.id}/subjects`}
        style={{ display: "flex", gap: "0.5rem" }}
      >
        <input name="name" placeholder="e.g. System Design" required />
        <button type="submit">Create</button>
      </form>
      {error === "subject-name" ? <p role="alert">Subject name can&apos;t be empty.</p> : null}
    </main>
  );
}
