export type Email = {
  subject: string;
  text: string;
  /** Sends sharing a key within the provider's window deliver only once. */
  idempotencyKey?: string;
};

/** Sends an email to the app's single user. */
export interface EmailPort {
  send(email: Email): Promise<void>;
}
