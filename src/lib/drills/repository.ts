import type { Drill, DrillScope } from "./types";

export type CreateDrillInput = {
  domainId: string;
  scope: DrillScope;
  scopeDetail?: Record<string, unknown> | null;
};

export interface DrillsRepository {
  createDrill(input: CreateDrillInput): Promise<Drill>;
  getDrill(id: string): Promise<Drill | null>;
}
