import { notFound } from "next/navigation";
import { getQuestionsRepository } from "@/lib/questions/get-repository";

export default async function QuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ attemptId?: string; error?: string }>;
}) {
  const { questionId } = await params;
  const { attemptId, error } = await searchParams;
  const repo = getQuestionsRepository();

  const question = await repo.getQuestion(questionId);
  if (!question) {
    notFound();
  }

  const attempt = attemptId ? await repo.getAttempt(attemptId) : null;
  const result = attempt && attempt.questionId === question.id ? attempt : null;

  return (
    <main style={{ maxWidth: 560, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>{question.prompt}</h1>

      {result ? (
        <section>
          <p>
            <strong>Your answer:</strong> {result.submittedAnswer}
          </p>
          <p>
            <strong>Confidence:</strong> {result.confidence}
          </p>
          <p>
            <strong>Result:</strong> {result.correctness}
          </p>
          <p>{result.gradedExplanation}</p>
        </section>
      ) : (
        <form
          method="post"
          action={`/api/questions/${question.id}/attempts`}
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
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
      )}
    </main>
  );
}
