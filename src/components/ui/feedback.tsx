import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** An error or notice shown in place, e.g. from an `?error=` redirect. */
export function InlineAlert({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-control border border-incorrect/30 bg-incorrect-wash px-3.5 py-2.5 text-sm text-text",
        className,
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-incorrect" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** What to do when a list has nothing in it yet. */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-y border-dashed border-line py-8", className)}>
      <p className="font-serif text-lg text-text">{title}</p>
      {children ? <p className="mt-1 max-w-prose text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
