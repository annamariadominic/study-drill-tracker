import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

export type Crumb = { label: string; href: string };

const HEADER = "mb-10 flex flex-col gap-3";

/** Where a page sits in the Domain > Subject > Concept hierarchy. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
        {crumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex min-w-0 items-center gap-1">
            {index > 0 ? <ChevronRight aria-hidden className="size-3.5 shrink-0 text-faint" /> : null}
            <Link
              href={crumb.href}
              className="truncate rounded-[2px] transition-colors hover:text-text"
            >
              {crumb.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A page's title block: optional breadcrumb and kicker, serif title, description and actions. */
export function PageHeader({
  crumbs,
  kicker,
  title,
  description,
  actions,
  children,
  className,
}: {
  crumbs?: Crumb[];
  /** A short line above the title naming what kind of thing this page is. */
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons aligned with the title on wide screens. */
  actions?: ReactNode;
  /** Anything that belongs under the title, e.g. a rename disclosure. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn(HEADER, className)}>
      {crumbs && crumbs.length > 0 ? <Breadcrumbs crumbs={crumbs} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {kicker ? <p className="mb-1 text-xs text-muted">{kicker}</p> : null}
          <h1 className="font-serif text-2xl font-normal tracking-[-0.01em] text-balance text-text">{title}</h1>
          {description ? <p className="mt-2 max-w-prose text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** A section heading inside a page, with an optional count and trailing content. */
export function SectionHeading({
  children,
  count,
  trailing,
  id,
  className,
}: {
  children: ReactNode;
  count?: number;
  trailing?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-4 border-b border-line pb-2", className)}>
      <h2 id={id} className="text-sm font-semibold text-text">
        {children}
        {count !== undefined ? <span className="ml-2 font-normal tabular-nums text-faint">{count}</span> : null}
      </h2>
      {trailing}
    </div>
  );
}

/**
 * PageHeader's shape while the page loads. Each line is one line-height of the
 * type it stands in for, so the real header takes exactly its place. Say
 * which of breadcrumb, description and actions the page has, or it jumps.
 */
export function PageHeaderSkeleton({
  crumbs = false,
  description = false,
  actions = false,
}: {
  crumbs?: boolean;
  description?: boolean;
  actions?: boolean;
}) {
  return (
    <div className={HEADER}>
      {crumbs ? <Skeleton className="h-(--text-xs--line-height) w-12" /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-(--text-2xl--line-height) w-56 max-w-full" />
          {description ? <Skeleton className="mt-2 h-(--text-sm--line-height) w-full max-w-md" /> : null}
        </div>
        {actions ? <Skeleton className="h-8 w-40 shrink-0" /> : null}
      </div>
    </div>
  );
}
