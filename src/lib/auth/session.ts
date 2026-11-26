import { jwtVerify, SignJWT } from "jose";
import { SESSION_DURATION_SECONDS, SESSION_RENEW_AFTER_SECONDS } from "./constants";

function toKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(secret: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(toKey(secret));
}

/** The session a token carries, or null unless it is validly signed and unexpired. */
export async function readSessionToken(
  token: string,
  secret: string,
): Promise<{ needsRenewal: boolean } | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, toKey(secret), { requiredClaims: ["iat", "exp"] });
    const ageSeconds = Date.now() / 1000 - (payload.iat ?? 0);
    return { needsRenewal: ageSeconds > SESSION_RENEW_AFTER_SECONDS };
  } catch {
    return null;
  }
}
