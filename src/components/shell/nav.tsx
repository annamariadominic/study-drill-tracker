"use client";

import { CalendarClock, CalendarDays, Library, NotebookPen, Shuffle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NavDomain = { id: string; name: string };

const STUDY_LINKS = [
  {
    href: "/study",
    label: "Study",
    icon: NotebookPen,
    isActive: (path: string) => path === "/study" || path.startsWith("/study/questions"),
  },
  { href: "/study/due", label: "Due for review", icon: CalendarClock, isActive: (path: string) => path === "/study/due" },
  { href: "/study/random", label: "Random Drill", icon: Shuffle, isActive: (path: string) => path === "/study/random" },
  {
    href: "/study/schedule",
    label: "Review schedule",
    icon: CalendarDays,
    isActive: (path: string) => path === "/study/schedule",
  },
];

/** The app's navigation: the study screens, then the syllabus with its Domains. */
export function Nav({ domains, onNavigate }: { domains: NavDomain[]; onNavigate?: () => void }) {
  const path = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-8">
      <ul className="flex flex-col gap-0.5">
        {STUDY_LINKS.map(({ href, label, icon: Icon, isActive }) => (
          <li key={href}>
            <NavLink href={href} active={isActive(path)} onNavigate={onNavigate}>
              <Icon aria-hidden className="size-4" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-0.5">
        <NavLink href="/domains" active={path === "/domains"} onNavigate={onNavigate}>
          <Library aria-hidden className="size-4" />
          Syllabus
        </NavLink>
        {domains.length > 0 ? (
          <ul className="ml-[1.1875rem] flex flex-col gap-0.5 border-l border-line pl-3">
            {domains.map((domain) => {
              const href = `/domains/${domain.id}`;
              return (
                <li key={domain.id}>
                  <NavLink
                    href={href}
                    active={path === href || path.startsWith(`${href}/`)}
                    onNavigate={onNavigate}
                    className="h-8 text-xs"
                  >
                    <span className="truncate">{domain.name}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </nav>
  );
}

function NavLink({
  href,
  active,
  onNavigate,
  className,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors duration-150",
        active ? "bg-surface text-text" : "text-muted hover:bg-surface/60 hover:text-text",
        className,
      )}
    >
      {children}
    </Link>
  );
}
