import type { ReactNode } from "react";
import { MobileNav } from "@/components/shell/mobile-nav";
import { Nav } from "@/components/shell/nav";
import { Wordmark } from "@/components/shell/wordmark";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

/**
 * The shell around every screen except login and the Drill itself: a sidebar
 * on wide screens, a top bar with a slide-in menu on narrow ones. It lists
 * Domains only; breadcrumbs carry the deeper hierarchy.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const domains = (await getSyllabusRepository().listDomains()).map(({ id, name }) => ({ id, name }));

  return (
    <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#content"
        className="sr-only z-50 rounded-control bg-accent px-3 py-2 text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/95 px-4 backdrop-blur-sm lg:hidden">
        <Wordmark />
        <MobileNav domains={domains} />
      </header>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-10 overflow-y-auto border-r border-line px-4 py-6 lg:flex">
        <div className="px-2.5">
          <Wordmark />
        </div>
        <Nav domains={domains} />
      </aside>

      <main id="content" className="min-w-0 px-4 pt-8 pb-20 sm:px-8 lg:px-14 lg:pt-14">
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
