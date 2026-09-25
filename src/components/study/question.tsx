import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { ChoiceGroup, Choice, ChoiceLetter, Segment } from "@/components/ui/choice";
import { InlineAlert } from "@/components/ui/feedback";
import { Label } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { PendingSubmit } from "@/components/ui/pending-submit";
import { CONFIDENCE_LABEL, CorrectnessMark } from "@/components/ui/status";
import type { Attempt, Question, QuestionType } from "@/lib/questions/types";
import { cn } from "@/lib/utils";

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

      {error === "grading-failed" ? <InlineAlert>Couldn&apos;t grade your answer right now. Try again.</InlineAlert> : null}

      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-faint">Rate your confidence before you see the grade.</p>
        <PendingSubmit size="lg" pendingLabel="Grading…">
          Submit answer
        </PendingSubmit>
      </div>
    </form>
  );
}

/**
 * How an Attempt was graded: the outcome, what was answered, why, and — for a
 * free-text Question — what a strong answer would have said.
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

  return (
    <section aria-labelledby="result-heading" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 border-t border-line pt-8">
        <h2 id="result-heading" className="sr-only">
          Result
        </h2>
        <CorrectnessMark correctness={attempt.correctness} size="lg" />
        <p className="text-xs text-muted">Your confidence: {CONFIDENCE_LABEL[attempt.confidence]}</p>
      </div>

      {isFlashcard ? (
        <FlashcardReview attempt={attempt} correctOption={correctOption} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">Your answer</p>
          <blockquote className="border-l-2 border-line-strong pl-4 text-sm leading-relaxed whitespace-pre-wrap text-muted">
            {attempt.submittedAnswer}
          </blockquote>
        </div>
      )}

      {attempt.gradedExplanation ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted">Feedback</p>
          <p className="max-w-prose font-serif text-lg leading-relaxed text-text">{attempt.gradedExplanation}</p>
        </div>
      ) : null}

      {!isFlashcard && attempt.referenceAnswer ? <ReferenceAnswer text={attempt.referenceAnswer} /> : null}

      {next ? <div className="border-t border-line pt-6">{next}</div> : null}
    </section>
  );
}

/**
 * The learner's answer and the correct one, each stated in full. The answer is
 * the text that was submitted and the correct one comes from its stored index,
 * so neither depends on matching option text (which may repeat).
 */
function FlashcardReview({ attempt, correctOption }: { attempt: Attempt; correctOption: string | null }) {
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
    <div className="flex flex-col gap-2 rounded-control border border-line px-4 py-3">
      <p className="flex items-center gap-1 text-xs font-medium text-correct">
        <Check aria-hidden className="size-3.5" />
        A strong answer
      </p>
      <p className="max-w-prose text-sm leading-relaxed whitespace-pre-wrap text-text">{text}</p>
    </div>
  );
}
