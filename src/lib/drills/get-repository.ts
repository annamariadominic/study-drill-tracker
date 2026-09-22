import { getSupabaseClient } from "@/lib/supabase/client";
import type { DrillsRepository } from "./repository";
import { SupabaseDrillsRepository } from "./supabase-repository";

let repository: DrillsRepository | undefined;

export function getDrillsRepository(): DrillsRepository {
  if (!repository) {
    repository = new SupabaseDrillsRepository(getSupabaseClient());
  }
  return repository;
}
