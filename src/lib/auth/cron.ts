import { isCorrectPassword } from "./password";

/**
 * Vercel Cron calls with `Authorization: Bearer <CRON_SECRET>`. This is the
 * cron route's only credential, separate from the user's session cookie
 * (ADR 0005).
 */
export function isAuthorizedCronRequest(authorization: string | null, cronSecret: string): boolean {
  if (!cronSecret || !authorization) {
    return false;
  }
  return isCorrectPassword(authorization, `Bearer ${cronSecret}`);
}
