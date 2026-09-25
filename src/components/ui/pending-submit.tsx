"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariantProps } from "./button";
import { PendingStatus, Spinner } from "./pending-status";

/**
 * A submit button for a plain HTML form post. Once its form submits, it
 * disables itself and shows `pendingLabel`, so a slow request (generating or
 * grading with the LLM) gets visible feedback and can't be sent twice. The
 * form itself still posts natively, exactly as before.
 */
export function PendingSubmit({
  children,
  pendingLabel,
  className,
  variant,
  size,
  ...props
}: Omit<ComponentProps<"button">, "type"> &
  ButtonVariantProps & { pendingLabel: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) {
      return;
    }
    const onSubmit = (event: SubmitEvent) => {
      if (!event.defaultPrevented) {
        setPending(true);
      }
    };
    // Coming back with the browser's back button restores the page as it was
    // left, so clear the pending state rather than showing a stuck spinner.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setPending(false);
      }
    };
    form.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return (
    <>
      <button
        ref={ref}
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className={cn(buttonVariants({ variant, size }), pending && "disabled:opacity-80", className)}
        {...props}
      >
        {pending ? (
          <>
            <Spinner />
            {pendingLabel}
          </>
        ) : (
          children
        )}
      </button>
      <PendingStatus pending={pending} label={pendingLabel} />
    </>
  );
}
