import type { SupabaseClient } from "@supabase/supabase-js";
import { initialReviewSchedule, pullReviewCloser, scheduleFromFields } from "@/lib/study/scheduling";
import { InvalidOrderError, NotFoundError } from "./errors";
import type { SyllabusRepository } from "./repository";
import type { Concept, ConceptStatus, Domain, StudiedConcept, Subject } from "./types";

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

/** A Concept row read back with its Subject, and that Subject's Domain, embedded. */
type ConceptInSyllabusRow = ConceptRow & { subject: SubjectRow & { domain: DomainRow } };

const CONCEPT_IN_SYLLABUS = "*, subject:subjects!inner(*, domain:domains!inner(*))";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Each ordered sibling list: its table, the parent it's scoped to, and its reorder function. */
const ORDERED_LISTS = {
  subjects: {
    parent: "Domain",
    parentColumn: "domain_id",
    reorderFn: "reorder_subjects",
    reorderArgs: (parentId: string, ids: string[]) => ({ target_domain_id: parentId, subject_ids: ids }),
  },
  concepts: {
    parent: "Subject",
    parentColumn: "subject_id",
    reorderFn: "reorder_concepts",
    reorderArgs: (parentId: string, ids: string[]) => ({ target_subject_id: parentId, concept_ids: ids }),
  },
} as const;

type OrderedList = keyof typeof ORDERED_LISTS;

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
    const position = await this.nextPosition("subjects", domainId);
    const { data, error } = await this.client
      .from("subjects")
      .insert({ domain_id: domainId, name: input.name, position })
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
    await this.reorder("subjects", domainId, subjectIds);
  }

  /**
   * The position that puts a new item at the bottom of its parent's list. Two
   * creates racing on one parent would collide on the (parent, position)
   * constraint and one would fail, rather than store a duplicate position.
   */
  private async nextPosition(list: OrderedList, parentId: string): Promise<number> {
    const { data, error } = await this.client
      .from(list)
      .select("position")
      .eq(ORDERED_LISTS[list].parentColumn, parentId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? (data as { position: number }).position + 1 : 0;
  }

  /**
   * Calls the list's reorder function, which validates the sibling list and
   * rewrites positions in one transaction, and maps its errors.
   */
  private async reorder(list: OrderedList, parentId: string, ids: string[]): Promise<void> {
    const { parent, reorderFn, reorderArgs } = ORDERED_LISTS[list];
    // Checked here so a malformed parent id reads as not found, rather than as
    // the invalid-uuid error (22P02) a malformed child id gets below.
    if (!UUID.test(parentId)) throw new NotFoundError(parent, parentId);
    const { error } = await this.client.rpc(reorderFn, reorderArgs(parentId, ids));
    if (!error) return;
    if (error.code === "P0002") throw new NotFoundError(parent, parentId);
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
    const position = await this.nextPosition("concepts", subjectId);
    const { data, error } = await this.client
      .from("concepts")
      .insert({ subject_id: subjectId, name: input.name, notes: input.notes ?? null, position })
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
    await this.reorder("concepts", subjectId, conceptIds);
  }

  async listStudiedConcepts(): Promise<StudiedConcept[]> {
    const { data, error } = await this.client
      .from("concepts")
      .select(CONCEPT_IN_SYLLABUS)
      .eq("status", "studied");
    if (error) throw error;
    // Sorted here rather than by the query: it's syllabus order across three
    // tables, which PostgREST can't order a flat list of Concepts by.
    return (data as ConceptInSyllabusRow[])
      .map((row) => ({
        concept: toConcept(row),
        subject: toSubject(row.subject),
        domain: toDomain(row.subject.domain),
      }))
      .sort(
        (a, b) =>
          Date.parse(a.domain.createdAt) - Date.parse(b.domain.createdAt) ||
          a.domain.id.localeCompare(b.domain.id) ||
          a.subject.position - b.subject.position ||
          a.concept.position - b.concept.position,
      );
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
