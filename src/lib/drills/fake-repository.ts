import { randomUUID } from "node:crypto";
import type { CreateDrillInput, DrillsRepository } from "./repository";
import type { Drill } from "./types";

export class FakeDrillsRepository implements DrillsRepository {
  private drills = new Map<string, Drill>();

  async createDrill(input: CreateDrillInput): Promise<Drill> {
    const drill: Drill = {
      id: randomUUID(),
      domainId: input.domainId,
      scope: input.scope,
      scopeDetail: input.scopeDetail ?? null,
      createdAt: new Date().toISOString(),
    };
    this.drills.set(drill.id, drill);
    return drill;
  }

  async getDrill(id: string): Promise<Drill | null> {
    return this.drills.get(id) ?? null;
  }
}
