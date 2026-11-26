import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, readSessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/auth/constants";
import { getSessionSecret } from "@/lib/auth/env";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await readSessionToken(token, getSessionSecret()) : null;
  const isLoginPage = request.nextUrl.pathname === "/login";

  if (!session) {
    return isLoginPage ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
  }

  // A bookmark of /login shouldn't ask someone already signed in for the password.
  const response = isLoginPage
    ? NextResponse.redirect(new URL("/", request.url))
    : NextResponse.next();

  if (session.needsRenewal) {
    response.cookies.set(
      SESSION_COOKIE_NAME,
      await createSessionToken(getSessionSecret()),
      SESSION_COOKIE_OPTIONS,
    );
  }
  return response;
}

// Of the cron routes, only this one is excluded: it authenticates with CRON_SECRET, not the
// session cookie (ADR 0005). The icons and manifest are public because browsers fetch them
// without that cookie.
export const config = {
  matcher: [
    "/((?!api/login(?:/|$)|api/cron/due-reminder(?:/|$)|_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest).*)",
  ],
};
