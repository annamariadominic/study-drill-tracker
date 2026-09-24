import { describe, expect, it } from "vitest";
import { FakeSyllabusRepository } from "@/lib/syllabus/fake-repository";
import { FakeEmailPort } from "./fake-email-port";
import { sendDueReminder } from "./send-due-reminder";

const DUE_LIST_URL = "https://drills.example.com/study/due";

async function repoWithConcepts(input: { due: number; notYetDue: number }) {
  const repo = new FakeSyllabusRepository();
  const domain = await repo.createDomain({ name: "Software Engineering" });
  const subject = await repo.createSubject(domain.id, { name: "System Design" });

  for (let i = 0; i < input.due; i++) {
    const concept = await repo.createConcept(subject.id, { name: `Due ${i}` });
    await repo.setConceptStatus(concept.id, "studied");
  }
  for (let i = 0; i < input.notYetDue; i++) {
    const concept = await repo.createConcept(subject.id, { name: `Later ${i}` });
    await repo.setConceptStatus(concept.id, "studied");
    await repo.updateConceptReviewSchedule(concept.id, {
      intervalDays: 10,
      easeFactor: 2.5,
      nextDueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }
  await repo.createConcept(subject.id, { name: "Planned" });

  return repo;
}

describe("sendDueReminder", () => {
  it("sends exactly one email with the due-count and a link into the app", async () => {
    const syllabusRepo = await repoWithConcepts({ due: 3, notYetDue: 2 });
    const emailPort = new FakeEmailPort();

    const result = await sendDueReminder({ syllabusRepo, emailPort }, { dueListUrl: DUE_LIST_URL });

    expect(result).toEqual({ dueCount: 3, sent: true });
    expect(emailPort.sent).toHaveLength(1);
    const [email] = emailPort.sent;
    expect(email.subject).toContain("3");
    expect(email.text).toContain("3");
    expect(email.text).toContain(DUE_LIST_URL);
  });

  it("uses the singular when one Concept is due", async () => {
    const syllabusRepo = await repoWithConcepts({ due: 1, notYetDue: 0 });
    const emailPort = new FakeEmailPort();

    await sendDueReminder({ syllabusRepo, emailPort }, { dueListUrl: DUE_LIST_URL });

    expect(emailPort.sent[0].subject).toBe("1 Concept due for review");
  });

  it("keys the email to the day so a repeated cron run doesn't send it twice", async () => {
    const syllabusRepo = await repoWithConcepts({ due: 1, notYetDue: 0 });
    const emailPort = new FakeEmailPort();

    await sendDueReminder(
      { syllabusRepo, emailPort },
      { dueListUrl: DUE_LIST_URL, now: new Date("2099-03-04T08:00:00Z") },
    );

    expect(emailPort.sent[0].idempotencyKey).toBe("due-reminder/2099-03-04");
  });

  it("sends nothing when nothing is due", async () => {
    const syllabusRepo = await repoWithConcepts({ due: 0, notYetDue: 2 });
    const emailPort = new FakeEmailPort();

    const result = await sendDueReminder({ syllabusRepo, emailPort }, { dueListUrl: DUE_LIST_URL });

    expect(result).toEqual({ dueCount: 0, sent: false });
    expect(emailPort.sent).toHaveLength(0);
  });

  it("counts due Concepts as of the given moment", async () => {
    const syllabusRepo = await repoWithConcepts({ due: 0, notYetDue: 2 });
    const emailPort = new FakeEmailPort();
    const inElevenDays = new Date(Date.now() + 11 * 24 * 60 * 60 * 1000);

    const result = await sendDueReminder(
      { syllabusRepo, emailPort },
      { dueListUrl: DUE_LIST_URL, now: inElevenDays },
    );

    expect(result).toEqual({ dueCount: 2, sent: true });
  });
});
