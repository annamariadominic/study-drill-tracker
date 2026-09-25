import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The spinning icon for work in progress. It's decorative; pair it with PendingStatus. */
export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn("animate-spin", className)} />;
}

/**
 * Tells screen readers what's pending. Mounted from the start and only filled
 * in once pending, so the change is announced.
 */
export function PendingStatus({ pending, label }: { pending: boolean; label: ReactNode }) {
  return (
    <span role="status" className="sr-only">
      {pending ? label : null}
    </span>
  );
}
