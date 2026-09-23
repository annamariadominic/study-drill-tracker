import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron";

const SECRET = "cron-secret-value";

describe("isAuthorizedCronRequest", () => {
  it("accepts the bearer token matching CRON_SECRET", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rejects a missing Authorization header", () => {
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
  });

  it("rejects the wrong token", () => {
    expect(isAuthorizedCronRequest("Bearer not-the-secret", SECRET)).toBe(false);
  });

  it("rejects the secret without the Bearer scheme", () => {
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
  });
});
