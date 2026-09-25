import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { conceptList, DrillFrame, DrillResults } from "@/components/study/drill";
import { AnswerForm, AttemptFeedback, QuestionPrompt } from "@/components/study/question";
import { buttonVariants } from "@/components/ui/button";
import { PendingLink } from "@/components/ui/pending-link";
import { getDrillsRepository } from "@/lib/drills/get-repository";
import { stepOutcome } from "@/lib/drills/drill-progress";
import { drillConceptNames, loadDrill } from "@/lib/drills/load-drill";
import { getQuestionsRepository } from "@/lib/questions/get-repository";
import type { Question } from "@/lib/questions/types";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import { cn } from "@/lib/utils";

/** Only a scenario names its Concepts while it's asked; the others ask about one and give no hint. */
async function scenarioConcepts(question: Question) {
  if (question.type !== "scenario") {
    return undefined;
  }
  return conceptList(question, await drillConceptNames(getSyllabusRepository(), [question]));
}

export default async function DrillPage({
  params,
  searchParams,
}: {
  params: Promise<{ drillId: string }>;
  searchParams: Promise<{ attemptId?: string; error?: string }>;
}) {
  const { drillId } = await params;
  const { attemptId, error } = await searchParams;

  const loaded = await loadDrill(
    { drillsRepo: getDrillsRepository(), questionsRepo: getQuestionsRepository() },
    drillId,
  );
  if (!loaded) {
    notFound();
  }
  const { drill, progress } = loaded;

  const justAnswered = attemptId
    ? progress.steps.find((step) => step.attempt?.id === attemptId)
    : undefined;
  const outcomes = progress.steps.map(stepOutcome);
  const numberOf = (question: Question) => progress.steps.findIndex((step) => step.question.id === question.id) + 1;

  if (justAnswered?.attempt) {
    const { question, attempt } = justAnswered;
    return (
      <DrillFrame drill={drill} outcomes={outcomes} currentIndex={null}>
        <QuestionPrompt
          question={question}
          number={numberOf(question)}
          scenarioConcepts={await scenarioConcepts(question)}
          muted
        />
        <AttemptFeedback
          question={question}
          attempt={attempt}
          next={
            <PendingLink
              href={`/study/drills/${drill.id}`}
              icon={<ArrowRight aria-hidden />}
              pendingLabel={progress.completed ? "Loading your results…" : "Loading the next question…"}
              className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
            >
              {progress.completed ? "See your results" : "Next question"}
            </PendingLink>
          }
        />
      </DrillFrame>
    );
  }

  if (progress.currentQuestion) {
    const question = progress.currentQuestion;
    return (
      <DrillFrame drill={drill} outcomes={outcomes} currentIndex={numberOf(question) - 1}>
        <QuestionPrompt question={question} number={numberOf(question)} scenarioConcepts={await scenarioConcepts(question)} />
        <AnswerForm question={question} drillId={drill.id} error={error} />
      </DrillFrame>
    );
  }

  const conceptNames = await drillConceptNames(
    getSyllabusRepository(),
    progress.steps.map((step) => step.question),
  );

  return (
    <DrillFrame drill={drill} outcomes={outcomes} currentIndex={null}>
      <DrillResults drill={drill} progress={progress} conceptNames={conceptNames} />
    </DrillFrame>
  );
}
