import { Pencil } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * An edit form kept out of the way until asked for. Built on <details>, so it
 * opens and closes without any client JavaScript.
 */
export function EditDisclosure({
  label,
  openLabel = "Close",
  className,
  children,
}: {
  label: string;
  openLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={cn("group", className)}>
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-control px-2 -mx-2 text-xs text-muted transition-colors select-none hover:bg-surface hover:text-text [&::-webkit-details-marker]:hidden">
        <Pencil aria-hidden className="size-3.5" />
        <span className="group-open:hidden">{label}</span>
        <span className="hidden group-open:inline">{openLabel}</span>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
