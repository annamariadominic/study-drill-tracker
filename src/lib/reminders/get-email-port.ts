import type { EmailPort } from "./email-port";
import { ResendEmailPort } from "./resend-email-port";

let port: EmailPort | undefined;

export function getEmailPort(): EmailPort {
  if (!port) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.REMINDER_EMAIL_FROM;
    const to = process.env.REMINDER_EMAIL_TO;
    if (!apiKey || !from || !to) {
      throw new Error("RESEND_API_KEY, REMINDER_EMAIL_FROM and REMINDER_EMAIL_TO must be set");
    }
    port = new ResendEmailPort({ apiKey, from, to });
  }
  return port;
}
