import type { SupabaseClient } from "@supabase/supabase-js";
import { initialReviewSchedule, pullReviewCloser, scheduleFromFields } from "@/lib/study/scheduling";
import { NotFoundError } from "./errors";
import type { SyllabusRepository } from "./repository";
import type { Concept, ConceptStatus, Domain, Subject } from "./types";

type DomainRow = { id: string; name: string; created_at: string };
type SubjectRow = { id: string; domain_id: string; name: string; created_at: string };
type ConceptRow = {
  id: string;
  subject_id: string;
  name: string;
  notes: string | null;
  status: ConceptStatus;
  studied_at: string | null;
  created_at: string;
  review_interval_days: number | null;
  review_ease_factor: number | null;
  next_review_due_at: string | null;
};

function toDomain(row: DomainRow): Domain {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

function toSubject(row: SubjectRow): Subject {
  return { id: row.id, domainId: row.domain_id, name: row.name, createdAt: row.created_at };
}

function toConcept(row: ConceptRow): Concept {
  return {
    id: row.id,
    subjectId: row.subject_id,
    name: row.name,
    notes: row.notes,
    status: row.status,
    studiedAt: row.studied_at,
    createdAt: row.created_at,
    reviewIntervalDays: row.review_interval_days,
    reviewEaseFactor: row.review_ease_factor,
    nextReviewDueAt: row.next_review_due_at,
  };
}

export class SupabaseSyllabusRepository implements SyllabusRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listDomains(): Promise<Domain[]> {
    const { data, error } = await this.client
      .from("domains")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as DomainRow[]).map(toDomain);
  }

  async getDomain(id: string): Promise<Domain | null> {
    const { data, error } = await this.client
      .from("domains")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data as DomainRow) : null;
  }

  async createDomain(input: { name: string }): Promise<Domain> {
    const { data, error } = await this.client
      .from("domains")
      .insert({ name: input.name })
      .select()
      .single();
    if (error) throw error;
    return toDomain(data as DomainRow);
  }

  async updateDomain(id: string, input: { name: string }): Promise<Domain> {
    const { data, error } = await this.client
      .from("domains")
      .update({ name: input.name })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Domain", id);
    return toDomain(data as DomainRow);
  }

  async listSubjects(domainId: string): Promise<Subject[]> {
    const { data, error } = await this.client
      .from("subjects")
      .select("*")
      .eq("domain_id", domainId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as SubjectRow[]).map(toSubject);
  }

  async getSubject(id: string): Promise<Subject | null> {
    const { data, error } = await this.client
      .from("subjects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toSubject(data as SubjectRow) : null;
  }

  async createSubject(domainId: string, input: { name: string }): Promise<Subject> {
    const { data, error } = await this.client
      .from("subjects")
      .insert({ domain_id: domainId, name: input.name })
      .select()
      .single();
    if (error) throw error;
    return toSubject(data as SubjectRow);
  }

  async updateSubject(id: string, input: { name: string }): Promise<Subject> {
    const { data, error } = await this.client
      .from("subjects")
      .update({ name: input.name })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Subject", id);
    return toSubject(data as SubjectRow);
  }

  async listConcepts(subjectId: string): Promise<Concept[]> {
    const { data, error } = await this.client
      .from("concepts")
      .select("*")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as ConceptRow[]).map(toConcept);
  }

  async getConcept(id: string): Promise<Concept | null> {
    const { data, error } = await this.client
      .from("concepts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toConcept(data as ConceptRow) : null;
  }

  async createConcept(
    subjectId: string,
    input: { name: string; notes?: string | null },
  ): Promise<Concept> {
    const { data, error } = await this.client
      .from("concepts")
      .insert({ subject_id: subjectId, name: input.name, notes: input.notes ?? null })
      .select()
      .single();
    if (error) throw error;
    return toConcept(data as ConceptRow);
  }

  async updateConcept(
    id: string,
    input: { name?: string; notes?: string | null },
  ): Promise<Concept> {
    const existing = await this.getConcept(id);
    if (!existing) throw new NotFoundError("Concept", id);

    const notesChanged = input.notes !== undefined && input.notes !== existing.notes;
    const currentSchedule = scheduleFromFields(existing);
    const schedule =
      notesChanged && existing.status === "studied" && currentSchedule
        ? pullReviewCloser(currentSchedule)
        : null;

    const patch: Partial<
      Pick<
        ConceptRow,
        "name" | "notes" | "review_interval_days" | "review_ease_factor" | "next_review_due_at"
      >
    > = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (schedule) {
      patch.review_interval_days = schedule.intervalDays;
      patch.review_ease_factor = schedule.easeFactor;
      patch.next_review_due_at = schedule.nextDueAt;
    }

    const { data, error } = await this.client
      .from("concepts")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Concept", id);
    return toConcept(data as ConceptRow);
  }

  async setConceptStatus(id: string, status: ConceptStatus): Promise<Concept> {
    const schedule = status === "studied" ? initialReviewSchedule() : null;
    const { data, error } = await this.client
      .from("concepts")
      .update({
        status,
        studied_at: status === "studied" ? new Date().toISOString() : null,
        review_interval_days: schedule?.intervalDays ?? null,
        review_ease_factor: schedule?.easeFactor ?? null,
        next_review_due_at: schedule?.nextDueAt ?? null,
      })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Concept", id);
    return toConcept(data as ConceptRow);
  }

  async updateConceptReviewSchedule(
    id: string,
    schedule: { intervalDays: number; easeFactor: number; nextDueAt: string },
  ): Promise<Concept> {
    const { data, error } = await this.client
      .from("concepts")
      .update({
        review_interval_days: schedule.intervalDays,
        review_ease_factor: schedule.easeFactor,
        next_review_due_at: schedule.nextDueAt,
      })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError("Concept", id);
    return toConcept(data as ConceptRow);
  }
}
