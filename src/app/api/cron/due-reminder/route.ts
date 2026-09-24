import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/auth/cron";
import { getCronSecret } from "@/lib/auth/env";
import { getEmailPort } from "@/lib/reminders/get-email-port";
import { sendDueReminder } from "@/lib/reminders/send-due-reminder";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

/** Called daily by Vercel Cron (see vercel.json). */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), getCronSecret())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendDueReminder(
    { syllabusRepo: getSyllabusRepository(), emailPort: getEmailPort() },
    { dueListUrl: new URL("/study/due", request.url).toString() },
  );
  return NextResponse.json(result);
}
