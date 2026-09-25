"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";

/**
 * The trailing icon of a Drill's "Next question" link. Once clicked it turns
 * into a spinner until the next question arrives: the link stays on the same
 * route, so the route's loading.tsx doesn't show for it. Swapping one icon for
 * another of the same size keeps the button from shifting.
 */
export function NextStepIcon() {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <ArrowRight aria-hidden />}
      <span role="status" className="sr-only">
        {pending ? "Loading…" : null}
      </span>
    </>
  );
}
