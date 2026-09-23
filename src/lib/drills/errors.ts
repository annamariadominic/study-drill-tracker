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

export class NoStudiedConceptsError extends Error {
  constructor() {
    super("There are no studied Concepts to drill in that scope");
    this.name = "NoStudiedConceptsError";
  }
}

export class MixedDomainsError extends Error {
  constructor(domainIds: string[]) {
    super(`A Drill can't combine Concepts from different Domains: ${domainIds.join(", ")}`);
    this.name = "MixedDomainsError";
  }
}
