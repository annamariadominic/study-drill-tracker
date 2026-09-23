import { NextRequest } from "next/server";
// The docs name this unstable_doesProxyMatch; the installed Next still
// exports it under its middleware name.
import { getRedirectUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

const CRON_SECRET = "test-cron-secret";

describe("proxy", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.stubEnv("SESSION_SECRET", "test-session-secret-at-least-32-bytes-long");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("leaves the cron route to its own CRON_SECRET check", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/cron/due-reminder" })).toBe(false);
  });

  it("guards the rest of the app with the session cookie", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/study/due" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/drills" })).toBe(true);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/cronjobs" })).toBe(true);
  });

  it("does not let CRON_SECRET stand in for a session", async () => {
    const response = await proxy(
      new NextRequest("https://drills.example.com/study/due", {
        headers: { authorization: `Bearer ${CRON_SECRET}` },
      }),
    );

    expect(getRedirectUrl(response)).toBe("https://drills.example.com/login");
  });
});
