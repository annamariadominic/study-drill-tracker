import type { SupabaseClient } from "@supabase/supabase-js";
import { initialReviewSchedule, pullReviewCloser, scheduleFromFields } from "@/lib/study/scheduling";
import { InvalidOrderError, NotFoundError } from "./errors";
import type { SyllabusRepository } from "./repository";
import type { Concept, ConceptStatus, Domain, Subject } from "./types";

type DomainRow = { id: string; name: string; created_at: string };
type SubjectRow = { id: string; domain_id: string; name: string; position: number; created_at: string };
type ConceptRow = {
  id: string;
  subject_id: string;
  name: string;
  notes: string | null;
  position: number;
  status: ConceptStatus;
  studied_at: string | null;
  created_at: string;
  review_interval_days: number | null;
  review_ease_factor: number | null;
  next_review_due_at: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toDomain(row: DomainRow): Domain {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

function toSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    domainId: row.domain_id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
  };
}

function toConcept(row: ConceptRow): Concept {
  return {
    id: row.id,
    subjectId: row.subject_id,
    name: row.name,
    notes: row.notes,
    position: row.position,
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
      .order("position", { ascending: true });
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
    // A new Subject goes to the bottom of its Domain's list. Two creates racing
    // on one Domain would collide on the (domain_id, position) constraint and
    // one would fail, rather than store a duplicate position.
    const { data: last, error: lastError } = await this.client
      .from("subjects")
      .select("position")
      .eq("domain_id", domainId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;

    const { data, error } = await this.client
      .from("subjects")
      .insert({ domain_id: domainId, name: input.name, position: last ? last.position + 1 : 0 })
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

  async reorderSubjects(domainId: string, subjectIds: string[]): Promise<void> {
    await this.reorder("reorder_subjects", { entity: "Domain", id: domainId }, {
      target_domain_id: domainId,
      subject_ids: subjectIds,
    });
  }

  /**
   * Calls one of the reorder_* functions, which validate the sibling list and
   * rewrite positions in one transaction, and maps their errors.
   */
  private async reorder(
    fn: "reorder_subjects" | "reorder_concepts",
    parent: { entity: "Domain" | "Subject"; id: string },
    args: Record<string, unknown>,
  ): Promise<void> {
    // Checked here so a malformed parent id reads as not found, rather than as
    // the invalid-uuid error (22P02) a malformed child id gets below.
    if (!UUID.test(parent.id)) throw new NotFoundError(parent.entity, parent.id);
    const { error } = await this.client.rpc(fn, args);
    if (!error) return;
    if (error.code === "P0002") throw new NotFoundError(parent.entity, parent.id);
    // 22023: not exactly the parent's children; 22P02: an id that isn't a uuid.
    if (error.code === "22023" || error.code === "22P02") throw new InvalidOrderError(error.message);
    throw error;
  }

  async listConcepts(subjectId: string): Promise<Concept[]> {
    const { data, error } = await this.client
      .from("concepts")
      .select("*")
      .eq("subject_id", subjectId)
      .order("position", { ascending: true });
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
    // A new Concept goes to the bottom of its Subject's list. Two creates racing
    // on one Subject would collide on the (subject_id, position) constraint and
    // one would fail, rather than store a duplicate position.
    const { data: last, error: lastError } = await this.client
      .from("concepts")
      .select("position")
      .eq("subject_id", subjectId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;

    const { data, error } = await this.client
      .from("concepts")
      .insert({
        subject_id: subjectId,
        name: input.name,
        notes: input.notes ?? null,
        position: last ? last.position + 1 : 0,
      })
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

  async reorderConcepts(subjectId: string, conceptIds: string[]): Promise<void> {
    await this.reorder("reorder_concepts", { entity: "Subject", id: subjectId }, {
      target_subject_id: subjectId,
      concept_ids: conceptIds,
    });
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
