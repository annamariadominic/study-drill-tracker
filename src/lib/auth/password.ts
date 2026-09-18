import { timingSafeEqual } from "node:crypto";

export function isCorrectPassword(candidate: string, expected: string): boolean {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  if (candidateBuffer.length !== expectedBuffer.length) {
    // Still perform a comparison of matching cost so a mismatched length
    // doesn't return faster than a mismatched value would.
    timingSafeEqual(candidateBuffer, candidateBuffer);
    return false;
  }

  return timingSafeEqual(candidateBuffer, expectedBuffer);
}
