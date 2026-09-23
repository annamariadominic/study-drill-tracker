export { NotFoundError } from "@/lib/errors";

/**
 * A Question whose Concepts don't fit its type — raised when creating one, and
 * when reading one back whose Concept links have been lost, rather than
 * quietly passing a malformed Question on.
 */
export class QuestionIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuestionIntegrityError";
  }
}
