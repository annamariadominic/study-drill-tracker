"use client";

import { X } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;

/** A panel that slides in from the left edge, used for navigation on small screens. */
export function SheetContent({ className, children, ...props }: ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 data-[state=closed]:opacity-0 starting:opacity-0" />
      <SheetPrimitive.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-bg shadow-2xl transition-transform duration-200 ease-out data-[state=closed]:-translate-x-full starting:-translate-x-full focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface hover:text-text">
          <X className="size-4" aria-hidden />
          <span className="sr-only">Close menu</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
