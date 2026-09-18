export class ConceptNotStudiedError extends Error {
  constructor(conceptId: string) {
    super(`Concept is not studied yet: ${conceptId}`);
    this.name = "ConceptNotStudiedError";
  }
}
