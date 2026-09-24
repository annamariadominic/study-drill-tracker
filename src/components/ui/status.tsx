import { Check, Minus, X } from "lucide-react";
import type { ConceptStatus as Status } from "@/lib/syllabus/types";
import type { Confidence, Correctness } from "@/lib/questions/types";
import { cn } from "@/lib/utils";

/** Planned is a hollow ring, studied a filled dot, so the state never rests on colour alone. */
export function ConceptStatusMark({ status, withLabel = false }: { status: Status; withLabel?: boolean }) {
  const studied = status === "studied";
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs", studied ? "text-text" : "text-muted")}>
      <span
        aria-hidden
        className={cn(
          "size-2.5 shrink-0 rounded-full",
          studied ? "bg-correct" : "border-[1.5px] border-faint",
        )}
      />
      <span className={withLabel ? undefined : "sr-only"}>{studied ? "Studied" : "Planned"}</span>
    </span>
  );
}

export const CORRECTNESS_LABEL: Record<Correctness, string> = {
  correct: "Correct",
  partial: "Partially correct",
  incorrect: "Incorrect",
};

const CORRECTNESS_STYLE: Record<Correctness, { icon: typeof Check; text: string; wash: string }> = {
  correct: { icon: Check, text: "text-correct", wash: "bg-correct-wash" },
  partial: { icon: Minus, text: "text-partial", wash: "bg-partial-wash" },
  incorrect: { icon: X, text: "text-incorrect", wash: "bg-incorrect-wash" },
};

/** A graded outcome as an icon plus its word, in the outcome's colour. */
export function CorrectnessMark({
  correctness,
  size = "sm",
  className,
}: {
  correctness: Correctness;
  size?: "sm" | "lg";
  className?: string;
}) {
  const { icon: Icon, text, wash } = CORRECTNESS_STYLE[correctness];
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        text,
        size === "lg" ? "gap-2.5 text-base" : "gap-1.5 text-xs",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full",
          wash,
          size === "lg" ? "size-7 [&_svg]:size-4" : "size-5 [&_svg]:size-3",
        )}
      >
        <Icon strokeWidth={2.5} />
      </span>
      {CORRECTNESS_LABEL[correctness]}
    </span>
  );
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  guessed: "Guessed",
  partial: "Partly sure",
  confident: "Confident",
};
