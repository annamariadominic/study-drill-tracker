export class NoDueConceptsError extends Error {
  constructor(domainId: string) {
    super(`No Concepts are due for review in Domain: ${domainId}`);
    this.name = "NoDueConceptsError";
  }
}

export class DrillGenerationError extends Error {
  constructor(conceptName: string, options?: { cause?: unknown }) {
    super(`Couldn't generate a Question for Concept: ${conceptName}`, options);
    this.name = "DrillGenerationError";
  }
}
