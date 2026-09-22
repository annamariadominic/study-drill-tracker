import type { Drill, DrillScope } from "./types";

export interface DrillsRepository {
  createDrill(input: {
    domainId: string;
    scope: DrillScope;
    scopeDetail?: Record<string, unknown> | null;
  }): Promise<Drill>;
  getDrill(id: string): Promise<Drill | null>;
}
