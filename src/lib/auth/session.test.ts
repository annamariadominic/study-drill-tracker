import { afterEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, readSessionToken } from "./session";

const SECRET = "test-session-secret-at-least-32-bytes-long";
const OTHER_SECRET = "a-completely-different-secret-value";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("session tokens", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("verifies a token signed with the same secret", async () => {
    const token = await createSessionToken(SECRET);
    expect(await readSessionToken(token, SECRET)).toEqual({ needsRenewal: false });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(SECRET);
    expect(await readSessionToken(token, OTHER_SECRET)).toBeNull();
  });

  it("rejects a malformed token", async () => {
    expect(await readSessionToken("not-a-real-token", SECRET)).toBeNull();
  });

  it("rejects an empty token", async () => {
    expect(await readSessionToken("", SECRET)).toBeNull();
  });

  it("asks to renew a token more than a day old", async () => {
    const token = await createSessionToken(SECRET);
    vi.useFakeTimers({ now: Date.now() + 2 * DAY_MS });
    expect(await readSessionToken(token, SECRET)).toEqual({ needsRenewal: true });
  });

  it("rejects a token after 30 days", async () => {
    const token = await createSessionToken(SECRET);
    vi.useFakeTimers({ now: Date.now() + 31 * DAY_MS });
    expect(await readSessionToken(token, SECRET)).toBeNull();
  });
});
