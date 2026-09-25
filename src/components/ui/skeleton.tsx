import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** A quiet placeholder block for content that's still loading. Size it to what it stands in for. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-surface-raised", className)} {...props} />;
}

/**
 * Wraps a page's loading placeholders: busy for assistive tech, which hears
 * "Loading…" once instead of a run of empty blocks.
 */
export function LoadingRegion({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div role="status" aria-busy className={className} {...props}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}
