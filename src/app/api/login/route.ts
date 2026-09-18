import { NextRequest, NextResponse } from "next/server";
import { isCorrectPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/auth/constants";
import { getAppPassword, getSessionSecret } from "@/lib/auth/env";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = formData.get("password");

  if (typeof password !== "string" || !isCorrectPassword(password, getAppPassword())) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "1");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const token = await createSessionToken(getSessionSecret());
  const response = NextResponse.redirect(new URL("/", request.url), { status: 303 });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });
  return response;
}
