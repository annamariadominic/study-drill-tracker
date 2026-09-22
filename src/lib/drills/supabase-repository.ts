import type { SupabaseClient } from "@supabase/supabase-js";
import type { DrillsRepository } from "./repository";
import type { Drill, DrillScope } from "./types";

type DrillRow = {
  id: string;
  domain_id: string;
  scope: DrillScope;
  scope_detail: Record<string, unknown> | null;
  created_at: string;
};

function toDrill(row: DrillRow): Drill {
  return {
    id: row.id,
    domainId: row.domain_id,
    scope: row.scope,
    scopeDetail: row.scope_detail,
    createdAt: row.created_at,
  };
}

export class SupabaseDrillsRepository implements DrillsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createDrill(input: {
    domainId: string;
    scope: DrillScope;
    scopeDetail?: Record<string, unknown> | null;
  }): Promise<Drill> {
    const { data, error } = await this.client
      .from("drills")
      .insert({
        domain_id: input.domainId,
        scope: input.scope,
        scope_detail: input.scopeDetail ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return toDrill(data as DrillRow);
  }

  async getDrill(id: string): Promise<Drill | null> {
    const { data, error } = await this.client
      .from("drills")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toDrill(data as DrillRow) : null;
  }
}
