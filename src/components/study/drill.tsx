import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { DrillProgressBar } from "@/components/ui/drill-progress";
import { CorrectnessMark } from "@/components/ui/status";
import { stepOutcome, type DrillProgress, type StepOutcome } from "@/lib/drills/drill-progress";
import type { Drill } from "@/lib/drills/types";
import type { Correctness, Question } from "@/lib/questions/types";
import { feedbackPath } from "@/lib/study/grading";
import { GradingWatcher } from "./grading-watcher";
import { Grading, QUESTION_TYPE_LABEL } from "./question";

/** The names of the Concepts a Question asks about, in the order it presents them. */
export function conceptList(question: Question, conceptNames: Map<string, string>) {
  return question.conceptIds.map((conceptId) => conceptNames.get(conceptId) ?? "Unknown Concept");
}

/** Where leaving the Drill goes: back to the list it was started from. */
function origin(drill: Drill) {
  return drill.scope === "random"
    ? { href: "/study/random", label: "Random Drill" }
    : { href: "/study/due", label: "Due for review" };
}

/**
 * The Drill's own screen, without the app's navigation: a slim bar to leave
 * and see progress, then a single reading-width column.
 */
export function DrillFrame({
  drill,
  outcomes,
  currentIndex,
  children,
}: {
  drill: Drill;
  outcomes: (StepOutcome | null)[];
  currentIndex: number | null;
  children: ReactNode;
}) {
  const { href, label } = origin(drill);
  return (
    <DrillShell
      exit={
        <Link
          href={href}
          className="-ml-2 flex h-9 items-center gap-1.5 rounded-control px-2 text-xs text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <X aria-hidden className="size-4" />
          <span className="sm:hidden">
            Exit<span className="sr-only"> to {label}</span>
          </span>
          <span className="hidden sm:inline">Exit to {label}</span>
        </Link>
      }
      progress={<DrillProgressBar outcomes={outcomes} currentIndex={currentIndex} />}
    >
      {children}
    </DrillShell>
  );
}

/** The Drill screen's layout, shared by the real frame and its loading state so they line up. */
export function DrillShell({
  exit,
  progress,
  children,
}: {
  exit: ReactNode;
  progress: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-4 px-4 sm:px-6">
          {exit}
          {progress}
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-10 px-4 pt-10 pb-24 sm:px-6 sm:pt-16">{children}</main>
    </div>
  );
}

const BAR_FILL: Record<Correctness, string> = {
  correct: "bg-correct",
  partial: "bg-partial",
  incorrect: "bg-incorrect",
};

export function DrillResults({
  drill,
  progress,
  conceptNames,
}: {
  drill: Drill;
  progress: DrillProgress;
  conceptNames: Map<string, string>;
}) {
  const { summary } = progress;
  const outcomes = (["correct", "partial", "incorrect"] as const).filter((outcome) => summary[outcome] > 0);

  return (
    <>
      <div className="flex flex-col gap-5">
        <p className="text-xs text-muted">Drill complete</p>
        <h1 className="font-serif text-2xl font-normal text-text sm:text-[2.5rem] sm:leading-tight">
          {summary.correct} of {summary.total} correct
        </h1>
        {summary.total > 0 ? (
          <div aria-hidden className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            {outcomes.map((outcome) => (
              <span key={outcome} className={BAR_FILL[outcome]} style={{ flexGrow: summary[outcome] }} />
            ))}
          </div>
        ) : null}
        {summary.grading > 0 ? (
          <p className="text-sm text-muted">
            {summary.grading} still grading — the count updates as grades arrive.
          </p>
        ) : null}
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {(["correct", "partial", "incorrect"] as const).map((outcome) => (
            <li key={outcome} className="flex items-center gap-2">
              <CorrectnessMark correctness={outcome} />
              <span className="text-xs tabular-nums text-muted">{summary[outcome]}</span>
            </li>
          ))}
        </ul>
      </div>

      <ol className="divide-y divide-line border-y border-line">
        {progress.steps.map((step, index) => (
          <li key={step.question.id} className="flex items-start gap-4 py-4">
            <span className="w-5 shrink-0 pt-0.5 text-xs tabular-nums text-faint">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text">{conceptList(step.question, conceptNames).join(" + ")}</p>
              <p className="text-xs text-muted">{QUESTION_TYPE_LABEL[step.question.type]}</p>
              <p className="mt-2 sm:hidden">
                <StepResult outcome={stepOutcome(step)} feedbackHref={step.attempt ? feedbackPath(step.question, step.attempt.id) : undefined} />
              </p>
            </div>
            <span className="hidden shrink-0 pt-0.5 sm:block">
              <StepResult outcome={stepOutcome(step)} feedbackHref={step.attempt ? feedbackPath(step.question, step.attempt.id) : undefined} />
            </span>
          </li>
        ))}
      </ol>

      <GradingWatcher attemptIds={progress.gradingAttemptIds} />

      <div className="flex flex-col gap-3 sm:flex-row">
        {drill.scope === "random" ? (
          <Link href="/study/random" className={buttonVariants({ size: "lg" })}>
            Start another random Drill
          </Link>
        ) : (
          <Link href="/study/due" className={buttonVariants({ size: "lg" })}>
            Back to what&apos;s due
          </Link>
        )}
        <Link href="/study" className={buttonVariants({ size: "lg", variant: "secondary" })}>
          Back to Study
        </Link>
      </div>
    </>
  );
}

function StepResult({ outcome, feedbackHref }: { outcome: StepOutcome | null; feedbackHref?: string }) {
  switch (outcome) {
    case null:
      return <span className="text-xs text-faint">Unanswered</span>;
    case "grading":
      return <Grading className="text-xs" />;
    case "failed":
      return (
        <Link href={feedbackHref ?? "#"} className="text-xs text-muted underline underline-offset-2 hover:text-text">
          Couldn&apos;t grade — retry
        </Link>
      );
    default:
      return <CorrectnessMark correctness={outcome} />;
  }
}
