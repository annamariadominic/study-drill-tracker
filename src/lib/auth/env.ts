function requireEnv(name: "APP_PASSWORD" | "SESSION_SECRET"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

export function getAppPassword(): string {
  return requireEnv("APP_PASSWORD");
}

export function getSessionSecret(): string {
  return requireEnv("SESSION_SECRET");
}
