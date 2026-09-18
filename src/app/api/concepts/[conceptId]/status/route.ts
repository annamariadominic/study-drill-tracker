import { NextRequest, NextResponse } from "next/server";
import { NotFoundError } from "@/lib/syllabus/errors";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import type { ConceptStatus } from "@/lib/syllabus/types";

const VALID_STATUSES: ConceptStatus[] = ["planned", "studied"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conceptId: string }> },
) {
  const { conceptId } = await params;
  const formData = await request.formData();
  const status = formData.get("status");
  const domainId = formData.get("domainId");
  const subjectId = formData.get("subjectId");

  if (typeof domainId !== "string" || typeof subjectId !== "string") {
    return NextResponse.json({ error: "domainId and subjectId are required" }, { status: 400 });
  }

  if (typeof status !== "string" || !VALID_STATUSES.includes(status as ConceptStatus)) {
    return NextResponse.json({ error: "status must be 'planned' or 'studied'" }, { status: 400 });
  }

  try {
    await getSyllabusRepository().setConceptStatus(conceptId, status as ConceptStatus);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }

  return NextResponse.redirect(
    new URL(`/domains/${domainId}/subjects/${subjectId}`, request.url),
    { status: 303 },
  );
}
