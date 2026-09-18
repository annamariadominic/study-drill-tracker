import { NextRequest, NextResponse } from "next/server";
import { getRequiredField } from "@/lib/http/form";
import { NotFoundError } from "@/lib/syllabus/errors";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ conceptId: string }> },
) {
  const { conceptId } = await params;
  const formData = await request.formData();
  const name = getRequiredField(formData, "name");
  const notes = getRequiredField(formData, "notes");
  const domainId = formData.get("domainId");
  const subjectId = formData.get("subjectId");

  if (typeof domainId !== "string" || typeof subjectId !== "string") {
    return NextResponse.json({ error: "domainId and subjectId are required" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.redirect(
      new URL(`/domains/${domainId}/subjects/${subjectId}?error=concept-name`, request.url),
      { status: 303 },
    );
  }

  try {
    await getSyllabusRepository().updateConcept(conceptId, { name, notes });
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
