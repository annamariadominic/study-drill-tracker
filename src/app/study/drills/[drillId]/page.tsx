import Link from "next/link";
import { notFound } from "next/navigation";
import { drillProgress } from "@/lib/drills/drill-progress";
import { getDrillsRepository } from "@/lib/drills/get-repository";
import { getQuestionsRepository } from "@/lib/questions/get-repository";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export default async function DrillPage({
  params,
  searchParams,
}: {
  params: Promise<{ drillId: string }>;
  searchParams: Promise<{ attemptId?: string; error?: string }>;
}) {
  const { drillId } = await params;
  const { attemptId, error } = await searchParams;

  const drillsRepo = getDrillsRepository();
  const questionsRepo = getQuestionsRepository();

  const drill = await drillsRepo.getDrill(drillId);
  if (!drill) {
    notFound();
  }

  const questions = await questionsRepo.listDrillQuestions(drill.id);
  const attempts = await questionsRepo.listAttemptsForQuestions(
    questions.map((question) => question.id),
  );
  const progress = drillProgress(questions, attempts);

  const justAnswered = attemptId
    ? progress.steps.find((step) => step.attempt?.id === attemptId)
    : undefined;

  const heading = (
    <>
      <p>
        <Link href="/study/due">&larr; Due for review</Link>
      </p>
      <h1>Drill</h1>
      <p style={{ color: "#666" }}>
        {progress.answeredCount} of {progress.summary.total} answered
      </p>
    </>
  );

  if (justAnswered?.attempt) {
    const { attempt } = justAnswered;
    return (
      <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem" }}>
        {heading}
        <h2>{justAnswered.question.prompt}</h2>
        <p>
          <strong>Your answer:</strong> {attempt.submittedAnswer}
        </p>
        <p>
          <strong>Confidence:</strong> {attempt.confidence}
        </p>
        <p>
          <strong>Result:</strong> {attempt.correctness}
        </p>
        <p>{attempt.gradedExplanation}</p>
        <p>
          <Link href={`/study/drills/${drill.id}`}>
            {progress.completed ? "See your summary" : "Next question"} &rarr;
          </Link>
        </p>
      </main>
    );
  }

  if (progress.currentQuestion) {
    const question = progress.currentQuestion;
    return (
      <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem" }}>
        {heading}
        <h2>{question.prompt}</h2>

        <form
          method="post"
          action={`/api/questions/${question.id}/attempts`}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          <input type="hidden" name="drillId" value={drill.id} />

          {question.type === "flashcard" && question.options ? (
            <fieldset>
              <legend>Choose an answer</legend>
              {question.options.map((option, index) => (
                <label key={index} style={{ display: "block" }}>
                  <input type="radio" name="optionIndex" value={index} required />
                  {option}
                </label>
              ))}
            </fieldset>
          ) : (
            <label>
              Your answer
              <textarea name="submittedAnswer" rows={4} required />
            </label>
          )}

          <fieldset>
            <legend>Confidence</legend>
            <label>
              <input type="radio" name="confidence" value="guessed" required />
              Guessed
            </label>
            <label>
              <input type="radio" name="confidence" value="partial" required />
              Partial
            </label>
            <label>
              <input type="radio" name="confidence" value="confident" required />
              Confident
            </label>
          </fieldset>

          <button type="submit">Submit</button>

          {error === "grading-failed" ? (
            <p role="alert">Couldn&apos;t grade your answer right now. Please try again.</p>
          ) : null}
        </form>
      </main>
    );
  }

  const syllabusRepo = getSyllabusRepository();
  const conceptNames = new Map(
    await Promise.all(
      [...new Set(questions.map((question) => question.conceptId))].map(
        async (conceptId): Promise<[string, string]> => {
          const concept = await syllabusRepo.getConcept(conceptId);
          return [conceptId, concept?.name ?? "Unknown Concept"];
        },
      ),
    ),
  );

  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem" }}>
      {heading}
      <h2>Drill complete</h2>
      <p>
        {progress.summary.correct} correct, {progress.summary.partial} partial,{" "}
        {progress.summary.incorrect} incorrect, out of {progress.summary.total}.
      </p>

      <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {progress.steps.map((step) => (
          <li key={step.question.id} style={{ border: "1px solid #ccc", padding: "0.5rem" }}>
            <strong>{conceptNames.get(step.question.conceptId)}</strong>{" "}
            <span style={{ color: "#666" }}>({step.question.type})</span>
            <p style={{ margin: "0.25rem 0" }}>{step.attempt?.correctness ?? "unanswered"}</p>
          </li>
        ))}
      </ul>

      <p>
        <Link href="/study/due">Back to what&apos;s due</Link>
      </p>
    </main>
  );
}
