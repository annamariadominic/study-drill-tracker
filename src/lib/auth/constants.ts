export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
/** A session older than this is renewed on use, so only 30 idle days end it. */
export const SESSION_RENEW_AFTER_SECONDS = 60 * 60 * 24;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: SESSION_DURATION_SECONDS,
  path: "/",
} as const;
