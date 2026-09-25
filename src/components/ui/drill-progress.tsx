import type { StepOutcome } from "@/lib/drills/drill-progress";
import { cn } from "@/lib/utils";

const FILLED: Record<StepOutcome, string> = {
  correct: "bg-correct",
  partial: "bg-partial",
  incorrect: "bg-incorrect",
  grading: "bg-faint animate-pulse motion-reduce:animate-none",
  failed: "bg-faint",
};

/**
 * One segment per Question: answered ones take their outcome's colour (a
 * neutral one, pulsing, while still being graded), the current one is the
 * accent, the rest are empty. The count beside it says the same thing in words.
 */
export function DrillProgressBar({
  outcomes,
  currentIndex,
  className,
}: {
  /** Each Question's outcome in Drill order, or null while unanswered. */
  outcomes: (StepOutcome | null)[];
  /** The Question being asked now, or null when none is (feedback or summary). */
  currentIndex: number | null;
  className?: string;
}) {
  const answered = outcomes.filter((outcome) => outcome !== null).length;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div aria-hidden className="flex w-20 gap-1 sm:w-36">
        {outcomes.map((outcome, index) => (
          <span
            key={index}
            data-outcome={outcome ?? undefined}
            className={cn(
              "h-1 flex-1 rounded-full",
              outcome ? FILLED[outcome] : index === currentIndex ? "bg-accent" : "bg-line-strong",
            )}
          />
        ))}
      </div>
      <span className="text-xs whitespace-nowrap tabular-nums text-muted">
        {answered} of {outcomes.length} answered
      </span>
    </div>
  );
}
