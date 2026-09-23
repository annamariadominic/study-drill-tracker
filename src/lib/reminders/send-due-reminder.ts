import type { SyllabusRepository } from "@/lib/syllabus/repository";
import { listDueConcepts } from "@/lib/syllabus/list-due-concepts";
import type { Email, EmailPort } from "./email-port";

export type DueReminderResult = {
  dueCount: number;
  sent: boolean;
};

function reminderEmail(dueCount: number, dueListUrl: string, now: Date): Email {
  const due = dueCount === 1 ? "1 Concept" : `${dueCount} Concepts`;
  return {
    subject: `${due} due for review`,
    text: `You have ${due} due for review.\n\nStart a Drill: ${dueListUrl}\n`,
    idempotencyKey: `due-reminder/${now.toISOString().slice(0, 10)}`,
  };
}

/**
 * The daily reminder (ADR 0004): one email when anything is due, nothing
 * otherwise. The due-count comes from the same due-list the app shows.
 */
export async function sendDueReminder(
  deps: { syllabusRepo: SyllabusRepository; emailPort: EmailPort },
  input: { dueListUrl: string; now?: Date },
): Promise<DueReminderResult> {
  const now = input.now ?? new Date();
  const dueConcepts = await listDueConcepts(deps.syllabusRepo, now);
  const dueCount = dueConcepts.length;

  if (dueCount === 0) {
    return { dueCount, sent: false };
  }

  await deps.emailPort.send(reminderEmail(dueCount, input.dueListUrl, now));
  return { dueCount, sent: true };
}
