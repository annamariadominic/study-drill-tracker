export class ConceptNotStudiedError extends Error {
  constructor(conceptId: string) {
    super(`Concept is not studied yet: ${conceptId}`);
    this.name = "ConceptNotStudiedError";
  }
}

/** Grading can only be retried once it has failed, or stalled past its time limit. */
export class GradingNotFailedError extends Error {
  constructor(attemptId: string) {
    super(`Attempt's grading hasn't failed: ${attemptId}`);
    this.name = "GradingNotFailedError";
  }
}
