import { getSupabaseClient } from "@/lib/supabase/client";
import type { QuestionsRepository } from "./repository";
import { SupabaseQuestionsRepository } from "./supabase-repository";

let repository: QuestionsRepository | undefined;

export function getQuestionsRepository(): QuestionsRepository {
  if (!repository) {
    repository = new SupabaseQuestionsRepository(getSupabaseClient());
  }
  return repository;
}
