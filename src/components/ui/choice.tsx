import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A group of native radio buttons or checkboxes. The inputs stay real form
 * controls (so plain HTML form posts and keyboard behaviour keep working);
 * only their presentation is custom, driven by :checked through CSS.
 */
export function ChoiceGroup({
  legend,
  hideLegend = false,
  layout = "stack",
  className,
  children,
}: {
  legend: ReactNode;
  hideLegend?: boolean;
  layout?: "stack" | "segmented";
  className?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className={cn("mb-2 text-xs font-medium text-muted", hideLegend && "sr-only")}>{legend}</legend>
      <div className={cn(layout === "stack" ? "flex flex-col gap-2" : "grid grid-cols-3 gap-2")}>{children}</div>
    </fieldset>
  );
}

const choiceFrame =
  "group relative flex cursor-pointer rounded-control border border-line bg-surface/40 text-text transition-colors duration-150 hover:border-line-strong hover:bg-surface has-checked:border-accent has-checked:bg-accent-wash has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent has-disabled:cursor-not-allowed has-disabled:opacity-50";

type ChoiceInputProps = {
  type?: "radio" | "checkbox";
  name: string;
  value: string | number;
  required?: boolean;
  defaultChecked?: boolean;
};

/** One stacked option: an indicator (or a custom marker) beside its label. */
export function Choice({
  type = "radio",
  name,
  value,
  required,
  defaultChecked,
  marker,
  description,
  className,
  children,
}: ChoiceInputProps & {
  /** Replaces the default radio/checkbox indicator, e.g. an answer letter. */
  marker?: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn(choiceFrame, "items-start gap-3 px-4 py-3", className)}>
      <input
        className="peer sr-only"
        type={type}
        name={name}
        value={value}
        required={required}
        defaultChecked={defaultChecked}
      />
      {marker ?? <ChoiceIndicator type={type} />}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="leading-6">{children}</span>
        {description ? <span className="text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

/** A letter badge for multiple-choice options that fills in when chosen. */
export function ChoiceLetter({ index }: { index: number }) {
  return (
    <span
      aria-hidden
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[3px] border border-line-strong text-[0.6875rem] font-semibold text-muted transition-colors group-has-checked:border-accent group-has-checked:bg-accent group-has-checked:text-accent-ink"
    >
      {String.fromCharCode(65 + index)}
    </span>
  );
}

function ChoiceIndicator({ type }: { type: "radio" | "checkbox" }) {
  if (type === "checkbox") {
    return (
      <span
        aria-hidden
        className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-[3px] border border-line-strong transition-colors group-has-checked:border-accent group-has-checked:bg-accent group-has-checked:text-accent-ink [&_svg]:opacity-0 group-has-checked:[&_svg]:opacity-100"
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-line-strong transition-colors group-has-checked:border-accent after:size-2 after:rounded-full after:bg-accent after:opacity-0 after:transition-opacity group-has-checked:after:opacity-100"
    />
  );
}

/** One option in a segmented row, e.g. a Confidence level. */
export function Segment({
  name,
  value,
  required,
  defaultChecked,
  children,
}: Omit<ChoiceInputProps, "type"> & { children: ReactNode }) {
  return (
    <label
      className={cn(
        choiceFrame,
        "h-10 items-center justify-center px-2 text-sm text-muted has-checked:text-accent-strong",
      )}
    >
      <input
        className="sr-only"
        type="radio"
        name={name}
        value={value}
        required={required}
        defaultChecked={defaultChecked}
      />
      {children}
    </label>
  );
}
