import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { getSessionSecret } from "@/lib/auth/env";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasValidSession = token
    ? await verifySessionToken(token, getSessionSecret())
    : false;

  if (hasValidSession) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!login(?:/|$)|api/login(?:/|$)|_next/static|_next/image|favicon.ico).*)",
  ],
};
