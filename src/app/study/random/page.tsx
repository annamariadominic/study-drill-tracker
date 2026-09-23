import Link from "next/link";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import { listStudiedConcepts, type StudiedConcept } from "@/lib/syllabus/list-studied-concepts";

const ERRORS: Record<string, string> = {
  "drill-generation-failed": "Couldn't generate a Drill right now. Please try again.",
  "nothing-studied": "There's nothing studied to drill there yet.",
  "no-concepts-picked": "Pick at least one Concept to drill.",
  "mixed-domains": "A Drill stays within one Domain, so pick Concepts from a single Domain.",
};

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

const sectionStyle = { display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "2rem" } as const;

export default async function RandomDrillPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const library = groupLibrary(await listStudiedConcepts(getSyllabusRepository()));

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <p>
        <Link href="/study">&larr; Study</Link>
      </p>

      <h1>Random Drill</h1>
      <p>Drill any time, whether or not anything is due. A Drill stays within one Domain.</p>

      {error && ERRORS[error] ? <p role="alert">{ERRORS[error]}</p> : null}

      {library.length === 0 ? (
        <p>No studied Concepts yet. Mark a Concept as studied on its Subject page first.</p>
      ) : (
        <>
          <form method="post" action="/api/drills/random" style={sectionStyle}>
            <h2 style={{ margin: 0 }}>Whole library</h2>
            <input type="hidden" name="kind" value="library" />
            <button type="submit">Start a random Drill</button>
          </form>

          <form method="post" action="/api/drills/random" style={sectionStyle}>
            <h2 style={{ margin: 0 }}>One Subject</h2>
            <input type="hidden" name="kind" value="subject" />
            <label>
              Subject{" "}
              <select name="subjectId" required>
                {library.map((domain) => (
                  <optgroup key={domain.id} label={domain.name}>
                    {domain.subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} ({subject.studied.length} studied)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button type="submit">Drill this Subject</button>
          </form>

          <form method="post" action="/api/drills/random" style={sectionStyle}>
            <h2 style={{ margin: 0 }}>Hand-picked Concepts</h2>
            <input type="hidden" name="kind" value="concepts" />
            {library.map((domain) => (
              <fieldset key={domain.id}>
                <legend>{domain.name}</legend>
                {domain.subjects.map((subject) => (
                  <div key={subject.id} style={{ marginBottom: "0.5rem" }}>
                    <p style={{ margin: "0.25rem 0", color: "#666" }}>{subject.name}</p>
                    {subject.studied.map(({ concept }) => (
                      <label key={concept.id} style={{ display: "block" }}>
                        <input type="checkbox" name="conceptId" value={concept.id} /> {concept.name}
                      </label>
                    ))}
                  </div>
                ))}
              </fieldset>
            ))}
            <button type="submit">Drill these Concepts</button>
          </form>
        </>
      )}
    </main>
  );
}
