import type { Email, EmailPort } from "./email-port";

export class FakeEmailPort implements EmailPort {
  sent: Email[] = [];

  async send(email: Email): Promise<void> {
    this.sent.push(email);
  }
}
