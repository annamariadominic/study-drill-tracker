import Link from "next/link";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const domains = await getSyllabusRepository().listDomains();

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Domains</h1>

      {domains.length === 0 ? (
        <p>No Domains yet.</p>
      ) : (
        <ul>
          {domains.map((domain) => (
            <li key={domain.id}>
              <Link href={`/domains/${domain.id}`}>{domain.name}</Link>
            </li>
          ))}
        </ul>
      )}

      <h2>New Domain</h2>
      <form method="post" action="/api/domains" style={{ display: "flex", gap: "0.5rem" }}>
        <input name="name" placeholder="e.g. Software Engineering" required />
        <button type="submit">Create</button>
      </form>
      {error === "domain-name" ? <p role="alert">Domain name can&apos;t be empty.</p> : null}
    </main>
  );
}
