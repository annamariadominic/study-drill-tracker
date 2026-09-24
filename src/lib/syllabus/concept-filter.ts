import type { Concept, ConceptStatus } from "./types";

/** The Subject page's `?show=` Concept filter: a status, or undefined for All. */
export function parseConceptFilter(param: string | undefined): ConceptStatus | undefined {
  return param === "studied" || param === "planned" ? param : undefined;
}

/**
 * The Concepts a filter shows. Only ever narrows the list, so the saved order
 * is kept and nothing about a filtered view can change it.
 */
export function filterConcepts(concepts: Concept[], show: ConceptStatus | undefined): Concept[] {
  return show ? concepts.filter((concept) => concept.status === show) : concepts;
}
