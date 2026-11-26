import { NextRequest } from "next/server";
// The docs name this unstable_doesProxyMatch; the installed Next still
// exports it under its middleware name.
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/auth/constants";
import { createSessionToken } from "@/lib/auth/session";
import { config, proxy } from "./proxy";

const CRON_SECRET = "test-cron-secret";
const SESSION_SECRET = "test-session-secret-at-least-32-bytes-long";
const DAY_MS = 24 * 60 * 60 * 1000;

function request(path: string, token?: string) {
  return new NextRequest(`https://drills.example.com${path}`, {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

describe("proxy", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("leaves the cron route to its own CRON_SECRET check", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/cron/due-reminder" })).toBe(false);
  });

  it("serves the icons and manifest without a session", () => {
    for (const url of ["/favicon.ico", "/icon.svg", "/apple-icon.png", "/manifest.webmanifest"]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    }
  });

  it("guards the rest of the app with the session cookie", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/study/due" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/drills" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/cronjobs" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/cron/other" })).toBe(true);
  });

  it("does not let CRON_SECRET stand in for a session", async () => {
    const response = await proxy(
      new NextRequest("https://drills.example.com/study/due", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    );

    expect(getRedirectUrl(response)).toBe("https://drills.example.com/login");
  });

  it("shows the login page only to someone signed out", async () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/login" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/login" })).toBe(false);

    expect(getRedirectUrl(await proxy(request("/login")))).toBeNull();
    expect(getRedirectUrl(await proxy(request("/login", "expired-or-forged")))).toBeNull();

    const token = await createSessionToken(SESSION_SECRET);
    expect(getRedirectUrl(await proxy(request("/login", token)))).toBe("https://drills.example.com/");
  });

  it("leaves a fresh session as it is", async () => {
    const token = await createSessionToken(SESSION_SECRET);
    const response = await proxy(request("/study", token));

    expect(getRedirectUrl(response)).toBeNull();
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it.each(["/study", "/login"])("renews a session over a day old at %s", async (path) => {
    const token = await createSessionToken(SESSION_SECRET);
    vi.useFakeTimers({ now: Date.now() + 2 * DAY_MS });
    const renewed = (await proxy(request(path, token))).cookies.get(SESSION_COOKIE_NAME);

    expect(renewed).toMatchObject({ httpOnly: true, secure: true, maxAge: SESSION_DURATION_SECONDS });
    expect(renewed?.value).not.toBe(token);
  });

  it("does not renew an expired session", async () => {
    const token = await createSessionToken(SESSION_SECRET);
    vi.useFakeTimers({ now: Date.now() + 31 * DAY_MS });
    const response = await proxy(request("/study", token));

    expect(getRedirectUrl(response)).toBe("https://drills.example.com/login");
    expect(response.cookies.get(SESSION_COOKIE_NAME)).toBeUndefined();
  });
});
