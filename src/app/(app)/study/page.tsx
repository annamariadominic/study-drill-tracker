import Link from "next/link";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import { listStudiedConcepts } from "@/lib/syllabus/list-studied-concepts";

export default async function StudyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const studiedConcepts = await listStudiedConcepts(getSyllabusRepository());

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Study</h1>
      <p>
        <Link href="/study/due">See what&apos;s due for review &rarr;</Link>
      </p>
      <p>
        <Link href="/study/random">Start a random Drill &rarr;</Link>
      </p>

      {studiedConcepts.length === 0 ? (
        <p>No studied Concepts yet. Mark a Concept as studied on its Subject page first.</p>
      ) : (
        <form
          method="post"
          action="/api/questions"
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <label>
            Concept
            <select name="conceptId" required>
              {studiedConcepts.map(({ concept, subject, domain }) => (
                <option key={concept.id} value={concept.id}>
                  {domain.name} / {subject.name} / {concept.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend>Question type</legend>
            <label>
              <input type="radio" name="type" value="recall" defaultChecked required />
              Recall (free text)
            </label>
            <label>
              <input type="radio" name="type" value="flashcard" required />
              Flashcard (multiple choice)
            </label>
          </fieldset>

          <button type="submit">Ask a question</button>
        </form>
      )}

      {error === "generation-failed" ? (
        <p role="alert">Couldn&apos;t generate a question right now. Please try again.</p>
      ) : null}
    </main>
  );
}
