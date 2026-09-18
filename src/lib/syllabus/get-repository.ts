import { getSupabaseClient } from "@/lib/supabase/client";
import type { SyllabusRepository } from "./repository";
import { SupabaseSyllabusRepository } from "./supabase-repository";

let repository: SyllabusRepository | undefined;

export function getSyllabusRepository(): SyllabusRepository {
  if (!repository) {
    repository = new SupabaseSyllabusRepository(getSupabaseClient());
  }
  return repository;
}
