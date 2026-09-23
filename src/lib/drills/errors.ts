export class NoDueConceptsError extends Error {
  constructor(domainId: string) {
    super(`No Concepts are due for review in Domain: ${domainId}`);
    this.name = "NoDueConceptsError";
  }
}

export class DrillGenerationError extends Error {
  constructor(conceptNames: string, options?: { cause?: unknown }) {
    super(`Couldn't generate a Question for Concept: ${conceptNames}`, options);
    this.name = "DrillGenerationError";
  }
}
