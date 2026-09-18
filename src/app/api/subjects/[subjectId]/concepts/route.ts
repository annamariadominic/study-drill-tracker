import { NextRequest, NextResponse } from "next/server";
import { getRequiredField } from "@/lib/http/form";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> },
) {
  const { subjectId } = await params;
  const formData = await request.formData();
  const domainId = formData.get("domainId");

  if (typeof domainId !== "string") {
    return NextResponse.json({ error: "domainId is required" }, { status: 400 });
  }

  const repo = getSyllabusRepository();
  const subject = await repo.getSubject(subjectId);
  if (!subject) {
    return NextResponse.json({ error: `Subject not found: ${subjectId}` }, { status: 404 });
  }

  const name = getRequiredField(formData, "name");
  const notes = getRequiredField(formData, "notes");

  if (!name) {
    return NextResponse.redirect(
      new URL(`/domains/${domainId}/subjects/${subjectId}?error=concept-name`, request.url),
      { status: 303 },
    );
  }

  await repo.createConcept(subjectId, { name, notes });

  return NextResponse.redirect(
    new URL(`/domains/${domainId}/subjects/${subjectId}`, request.url),
    { status: 303 },
  );
}
