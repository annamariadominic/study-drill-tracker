import { jwtVerify, SignJWT } from "jose";
import { SESSION_DURATION_SECONDS } from "./constants";

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

export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  if (!token) {
    return false;
  }

  try {
    await jwtVerify(token, toKey(secret));
    return true;
  } catch {
    return false;
  }
}
