import { describe, expect, it } from "vitest";
import { isCorrectPassword } from "./password";

describe("isCorrectPassword", () => {
  it("returns true when the candidate matches the expected password", () => {
    expect(isCorrectPassword("correct-horse", "correct-horse")).toBe(true);
  });

  it("returns false when the candidate does not match", () => {
    expect(isCorrectPassword("wrong", "correct-horse")).toBe(false);
  });

  it("returns false when the candidate has a different length", () => {
    expect(isCorrectPassword("short", "a-much-longer-password")).toBe(false);
  });

  it("returns false for an empty candidate against a non-empty password", () => {
    expect(isCorrectPassword("", "correct-horse")).toBe(false);
  });
});
