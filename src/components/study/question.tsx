import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { ChoiceGroup, Choice, ChoiceLetter, Segment } from "@/components/ui/choice";
import { InlineAlert } from "@/components/ui/feedback";
import { Label } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/ui/pending-status";
import { PendingSubmit } from "@/components/ui/pending-submit";
import { CONFIDENCE_LABEL, CorrectnessMark } from "@/components/ui/status";
import type { Attempt, GradedAttempt, Question, QuestionType } from "@/lib/questions/types";
import { gradingState } from "@/lib/study/grading";
import { cn } from "@/lib/utils";
import { GradingWatcher } from "./grading-watcher";

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  recall: "Recall",
  flashcard: "Flashcard",
  scenario: "Scenario",
};

/** "A", "A and B", "A, B and C". */
export function listNames(names: string[]) {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * A scenario sets up a whole situation, so it runs much longer than a recall
 * prompt. It stays in the reading face but a size down, with more leading and
 * a prose measure, so a long setup can be scanned rather than filling the
 * screen.
 */
const SCENARIO_PROMPT_TYPE = "max-w-prose text-base leading-[1.7] sm:text-lg sm:leading-[1.7]";

/**
 * The Question itself, set large in the reading face: the one thing on the
 * screen that should hold attention. A scenario gets a smaller, more readable
 * size for its longer prose (SCENARIO_PROMPT_TYPE).
 */
export function QuestionPrompt({
  question,
  number,
  scenarioConcepts,
  muted = false,
}: {
  question: Question;
  /** The Question's place in its Drill, counting from 1; omitted outside a Drill. */
  number?: number;
  /** For a scenario, the names of the Concepts it combines. */
  scenarioConcepts?: string[];
  /** Dimmed once answered, so the feedback takes over. */
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {number !== undefined ? <span className="tabular-nums">Question {number}</span> : null}
        <span className={cn(question.type === "scenario" && "text-accent")}>
          {question.type === "scenario" && scenarioConcepts && scenarioConcepts.length > 0
            ? `Scenario combining ${listNames(scenarioConcepts)}`
            : QUESTION_TYPE_LABEL[question.type]}
        </span>
      </p>
      <h1
        className={cn(
          "font-serif font-normal tracking-[-0.005em] text-pretty whitespace-pre-line transition-colors",
          question.type === "scenario"
            ? SCENARIO_PROMPT_TYPE
            : "text-[1.375rem] leading-[1.45] sm:text-[1.75rem] sm:leading-[1.4]",
          muted ? "text-muted" : "text-text",
        )}
      >
        {question.prompt}
      </h1>
    </div>
  );
}

/** The answer, the Confidence rating and the submit, posted to the attempts route as before. */
export function AnswerForm({
  question,
  drillId,
  error,
}: {
  question: Question;
  /** Set when answering inside a Drill, so the route returns there. */
  drillId?: string;
  error?: string;
}) {
  const isFlashcard = question.type === "flashcard" && question.options;

  return (
    <form method="post" action={`/api/questions/${question.id}/attempts`} className="flex flex-col gap-8">
      {drillId ? <input type="hidden" name="drillId" value={drillId} /> : null}

      {isFlashcard ? (
        <ChoiceGroup legend="Choose an answer" hideLegend>
          {question.options!.map((option, index) => (
            <Choice key={index} name="optionIndex" value={index} required marker={<ChoiceLetter index={index} />}>
              {option}
            </Choice>
          ))}
        </ChoiceGroup>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="answer" className="sr-only">
            Your answer
          </Label>
          <Textarea
            id="answer"
            name="submittedAnswer"
            rows={question.type === "scenario" ? 9 : 7}
            required
            placeholder="Write your answer in your own words…"
            className="rounded-panel bg-surface px-4 py-3.5 text-base leading-relaxed"
          />
        </div>
      )}

      <ChoiceGroup legend="How sure are you?" layout="segmented">
        {(["guessed", "partial", "confident"] as const).map((confidence) => (
          <Segment key={confidence} name="confidence" value={confidence} required>
            {CONFIDENCE_LABEL[confidence]}
          </Segment>
        ))}
      </ChoiceGroup>

      {error === "submit-failed" ? <InlineAlert>Couldn&apos;t submit your answer right now. Try again.</InlineAlert> : null}

      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-faint">Rate your confidence before you see the grade.</p>
        <PendingSubmit size="lg" pendingLabel="Submitting…">
          Submit answer
        </PendingSubmit>
      </div>
    </form>
  );
}

/**
 * How an Attempt was graded: the outcome, what was answered, why, and — for a
 * free-text Question — what a strong answer would have said. A free-text
 * answer shows at once while its grade is still coming (ADR 0011): the grade,
 * feedback and strong answer say they're grading and fill in when it arrives,
 * and a failed grade offers to retry. The way on is there throughout.
 */
export function AttemptFeedback({
  question,
  attempt,
  next,
}: {
  question: Question;
  attempt: Attempt;
  /** What to do next, e.g. the next-question button. */
  next?: ReactNode;
}) {
  const isFlashcard = question.type === "flashcard";
  const correctOption = isFlashcard ? (question.options?.[question.correctOptionIndex ?? -1] ?? null) : null;
  const graded = attempt.gradingStatus === "graded" ? attempt : null;
  const state = gradingState(attempt);

  return (
    <section aria-labelledby="result-heading" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 border-t border-line pt-8">
        <h2 id="result-heading" className="sr-only">
          Result
        </h2>
        {state === "failed" ? (
          <InlineAlert>Your answer couldn&apos;t be graded.</InlineAlert>
        ) : (
          // Kept in place from grading to graded, so the grade is announced when it arrives.
          <div role="status">
            {graded ? (
              <CorrectnessMark correctness={graded.correctness} size="lg" />
            ) : (
              <Grading className="text-base font-medium" />
            )}
          </div>
        )}
        <p className="text-xs text-muted">Your confidence: {CONFIDENCE_LABEL[attempt.confidence]}</p>
      </div>

      {isFlashcard && graded ? (
        <FlashcardReview attempt={graded} correctOption={correctOption} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">Your answer</p>
          <blockquote className="border-l-2 border-line-strong pl-4 text-sm leading-relaxed whitespace-pre-wrap text-muted">
            {attempt.submittedAnswer}
          </blockquote>
        </div>
      )}

      {state === "grading" ? (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted">Feedback</p>
            <Grading className="text-sm" />
          </div>
          {!isFlashcard ? (
            <ReferenceAnswerFrame>
              <Grading className="text-sm" />
            </ReferenceAnswerFrame>
          ) : null}
          <GradingWatcher attemptIds={[attempt.id]} />
        </>
      ) : null}

      {state === "failed" ? (
        <form method="post" action={`/api/attempts/${attempt.id}/grading`}>
          <PendingSubmit variant="secondary" pendingLabel="Retrying…">
            Retry grading
          </PendingSubmit>
        </form>
      ) : null}

      {graded?.gradedExplanation ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">Feedback</p>
          <p className="max-w-prose font-serif text-lg leading-relaxed text-text">{graded.gradedExplanation}</p>
        </div>
      ) : null}

      {!isFlashcard && graded?.referenceAnswer ? <ReferenceAnswer text={graded.referenceAnswer} /> : null}

      {next ? <div className="border-t border-line pt-6">{next}</div> : null}
    </section>
  );
}

/** Stands in for part of the feedback while the grade is on its way. */
export function Grading({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-muted", className)}>
      <Spinner className="size-4 motion-reduce:animate-none" />
      Grading…
    </span>
  );
}

/**
 * The learner's answer and the correct one, each stated in full. The answer is
 * the text that was submitted and the correct one comes from its stored index,
 * so neither depends on matching option text (which may repeat).
 */
function FlashcardReview({ attempt, correctOption }: { attempt: GradedAttempt; correctOption: string | null }) {
  const answeredCorrectly = attempt.correctness === "correct";
  return (
    <dl className="flex flex-col gap-2">
      <div
        className={cn(
          "flex flex-col gap-1 rounded-control border px-4 py-3",
          answeredCorrectly ? "border-correct/50 bg-correct-wash" : "border-incorrect/50 bg-incorrect-wash",
        )}
      >
        <dt
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            answeredCorrectly ? "text-correct" : "text-incorrect",
          )}
        >
          {answeredCorrectly ? <Check aria-hidden className="size-3.5" /> : <X aria-hidden className="size-3.5" />}
          Your answer
        </dt>
        <dd className="text-sm leading-6 text-text">{attempt.submittedAnswer}</dd>
      </div>
      {correctOption !== null ? (
        <div className="flex flex-col gap-1 rounded-control border border-line px-4 py-3">
          <dt className="flex items-center gap-1 text-xs font-medium text-correct">
            <Check aria-hidden className="size-3.5" />
            Correct answer
          </dt>
          <dd className="text-sm leading-6 text-text">{correctOption}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/**
 * The grader's model answer to a free-text Question, shown whatever the grade
 * so the learner always has the target to study from. Attempts graded before
 * reference answers existed have none, and show no section.
 */
function ReferenceAnswer({ text }: { text: string }) {
  return (
    <ReferenceAnswerFrame>
      <p className="max-w-prose text-sm leading-relaxed whitespace-pre-wrap text-text">{text}</p>
    </ReferenceAnswerFrame>
  );
}

function ReferenceAnswerFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-control border border-line px-4 py-3">
      <p className="flex items-center gap-1 text-xs font-medium text-correct">
        <Check aria-hidden className="size-3.5" />
        A strong answer
      </p>
      {children}
    </div>
  );
}
