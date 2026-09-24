import type { Email, EmailPort } from "./email-port";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";

export type ResendConfig = {
  apiKey: string;
  from: string;
  to: string;
};

/** Sends through Resend's REST API (ADR 0004). */
export class ResendEmailPort implements EmailPort {
  constructor(
    private readonly config: ResendConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(email: Email): Promise<void> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
    };
    if (email.idempotencyKey) {
      headers["Idempotency-Key"] = email.idempotencyKey;
    }

    const response = await this.fetchImpl(RESEND_EMAILS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: this.config.from,
        to: [this.config.to],
        subject: email.subject,
        text: email.text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend rejected the email (${response.status}): ${await response.text()}`);
    }
  }
}
