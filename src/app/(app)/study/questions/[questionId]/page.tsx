import { notFound } from "next/navigation";
import Link from "next/link";
import { AnswerForm, AttemptFeedback, QuestionPrompt } from "@/components/study/question";
import { Breadcrumbs } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="flex max-w-2xl flex-col gap-10">
      <Breadcrumbs crumbs={[{ label: "Study", href: "/study" }]} />
      <QuestionPrompt question={question} muted={Boolean(result)} />
      {result ? (
        <AttemptFeedback
          question={question}
          attempt={result}
          next={
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/study" className={buttonVariants({ size: "lg" })}>
                Ask another question
              </Link>
              <Link href="/study/random" className={buttonVariants({ size: "lg", variant: "secondary" })}>
                Start a random Drill
              </Link>
            </div>
          }
        />
      ) : (
        <AnswerForm question={question} error={error} />
      )}
    </div>
  );
}
