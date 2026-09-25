"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { PendingStatus, Spinner } from "./pending-status";

/**
 * A link that shows it was clicked while its page loads. For links that stay
 * on the same route and only change the search params: those don't re-show
 * the route's loading.tsx, so without this nothing happens until the server
 * answers.
 *
 * While pending, `icon` turns into a spinner of the same size, so nothing
 * shifts, and the link carries `data-pending` for any other styling. The
 * announcement sits beside the link, not in it, so it doesn't become part of
 * the link's name.
 */
export function PendingLink({
  icon,
  iconPosition = "end",
  pendingLabel = "Loading…",
  children,
  ...props
}: ComponentProps<typeof Link> & {
  icon?: ReactNode;
  iconPosition?: "start" | "end";
  pendingLabel?: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const status = <LinkStatus icon={icon} onChange={setPending} />;
  return (
    <>
      <Link data-pending={pending || undefined} {...props}>
        {iconPosition === "start" ? status : null}
        {children}
        {iconPosition === "end" ? status : null}
      </Link>
      <PendingStatus pending={pending} label={pendingLabel} />
    </>
  );
}

/** useLinkStatus only works inside the Link, so this reads it there and reports it up. */
function LinkStatus({ icon, onChange }: { icon: ReactNode; onChange: (pending: boolean) => void }) {
  const { pending } = useLinkStatus();
  useEffect(() => onChange(pending), [pending, onChange]);
  if (icon === undefined) {
    return null;
  }
  return pending ? <Spinner /> : icon;
}
