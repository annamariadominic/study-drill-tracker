import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Shared look for single-line inputs, textareas and native selects. */
export const controlClass =
  "w-full rounded-control border border-line-strong bg-surface px-3 text-sm text-text placeholder:text-faint transition-colors duration-150 hover:border-line-control focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-24 resize-y py-2.5 leading-relaxed", className)} {...props} />;
}

/**
 * A styled native select: it keeps working inside plain HTML form posts and
 * needs no client JavaScript.
 */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select className={cn(controlClass, "h-10 cursor-pointer appearance-none pr-9", className)} {...props} />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
      />
    </span>
  );
}
