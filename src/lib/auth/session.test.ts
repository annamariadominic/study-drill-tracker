import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";

const SECRET = "test-session-secret-at-least-32-bytes-long";
const OTHER_SECRET = "a-completely-different-secret-value";

describe("session tokens", () => {
  it("verifies a token signed with the same secret", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, SECRET)).toBe(true);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, OTHER_SECRET)).toBe(false);
  });

  it("rejects a malformed token", async () => {
    expect(await verifySessionToken("not-a-real-token", SECRET)).toBe(false);
  });

  it("rejects an empty token", async () => {
    expect(await verifySessionToken("", SECRET)).toBe(false);
  });
});
