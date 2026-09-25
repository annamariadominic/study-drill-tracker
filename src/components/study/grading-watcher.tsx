"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { GradingStatus } from "@/lib/questions/types";

const POLL_INTERVAL_MS = 1500;
/** Beyond the attempts route's max duration, grading can no longer finish: stop asking. */
const GIVE_UP_AFTER_MS = 5 * 60 * 1000;

/**
 * Watches Attempts still being graded and refreshes the page once any of them
 * has a grade (or has failed), so the server-rendered feedback fills in
 * without a reload. Renders nothing.
 */
export function GradingWatcher({ attemptIds }: { attemptIds: string[] }) {
  const router = useRouter();
  const watched = attemptIds.join(",");

  useEffect(() => {
    if (!watched) {
      return;
    }
    const ids = watched.split(",");
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const check = async () => {
      const statuses = await Promise.all(ids.map(gradingStatus));
      if (stopped) {
        return;
      }
      if (statuses.some((status) => status !== null && status !== "pending")) {
        router.refresh();
      } else if (Date.now() - startedAt < GIVE_UP_AFTER_MS) {
        timer = setTimeout(check, POLL_INTERVAL_MS);
      }
    };
    timer = setTimeout(check, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [watched, router]);

  return null;
}

/** null when the status couldn't be read this time, e.g. offline for a moment. */
async function gradingStatus(attemptId: string): Promise<GradingStatus | null> {
  try {
    const response = await fetch(`/api/attempts/${encodeURIComponent(attemptId)}/grading`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return ((await response.json()) as { gradingStatus: GradingStatus }).gradingStatus;
  } catch {
    return null;
  }
}
