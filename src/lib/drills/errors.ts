export class NoDueConceptsError extends Error {
  constructor(domainId: string) {
    super(`No Concepts are due for review in Domain: ${domainId}`);
    this.name = "NoDueConceptsError";
  }
}

export class DrillGenerationError extends Error {
  constructor(conceptNames: string[], options?: { cause?: unknown }) {
    const label = conceptNames.length === 1 ? "Concept" : "Concepts";
    super(`Couldn't generate a Question for ${label}: ${conceptNames.join(", ")}`, options);
    this.name = "DrillGenerationError";
  }
}
