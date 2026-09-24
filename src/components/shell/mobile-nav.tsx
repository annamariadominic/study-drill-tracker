"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Nav, type NavDomain } from "./nav";
import { Wordmark } from "./wordmark";

export function MobileNav({ domains }: { domains: NavDomain[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="-mr-2 flex size-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface hover:text-text">
        <Menu aria-hidden className="size-5" />
        <span className="sr-only">Open menu</span>
      </SheetTrigger>
      <SheetContent aria-describedby={undefined} className="gap-8 px-4 py-4">
        <SheetTitle asChild>
          <div className="flex h-10 items-center px-2.5">
            <Wordmark />
          </div>
        </SheetTitle>
        <Nav domains={domains} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
