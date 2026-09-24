import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";

/** Items separated by hairlines rather than boxed in cards. */
export function RowList({ className, ...props }: ComponentProps<"ul">) {
  return <ul className={cn("divide-y divide-line border-b border-line", className)} {...props} />;
}

/** A whole-row link to the next level down, e.g. a Domain to its Subjects. */
export function RowLink({ href, children, meta }: { href: string; children: ReactNode; meta?: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="group -mx-3 flex min-h-14 items-center gap-4 rounded-control px-3 py-3 transition-colors duration-150 hover:bg-surface"
      >
        <span className="min-w-0 flex-1 font-serif text-lg text-text">{children}</span>
        {meta ? <span className="shrink-0 text-xs text-muted">{meta}</span> : null}
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted"
        />
      </Link>
    </li>
  );
}

/** A one-field form for adding the next item to a list, set just below it. */
export function AddRow({
  action,
  label,
  placeholder,
  buttonLabel,
  hidden,
}: {
  action: string;
  label: string;
  placeholder: string;
  buttonLabel: string;
  /** Hidden inputs the route needs besides the name. */
  hidden?: ReactNode;
}) {
  const inputId = `add-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <form method="post" action={action} className="mt-6 flex flex-col gap-1.5">
      {hidden}
      <label htmlFor={inputId} className="text-xs font-medium text-muted">
        {label}
      </label>
      <div className="flex gap-2">
        <Input id={inputId} name="name" placeholder={placeholder} required className="flex-1" />
        <Button type="submit" variant="secondary">
          <Plus aria-hidden />
          {buttonLabel}
        </Button>
      </div>
    </form>
  );
}
