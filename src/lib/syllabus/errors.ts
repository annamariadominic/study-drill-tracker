export { NotFoundError } from "@/lib/errors";

/**
 * A requested order that isn't exactly the current siblings, each once — a
 * missing, repeated or foreign id. Rejected whole, so no order is half-applied.
 */
export class InvalidOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOrderError";
  }
}
