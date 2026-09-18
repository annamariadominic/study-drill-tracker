import { NextRequest, NextResponse } from "next/server";
import { getRequiredField } from "@/lib/http/form";
import { NotFoundError } from "@/lib/syllabus/errors";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> },
) {
  const { subjectId } = await params;
  const formData = await request.formData();
  const name = getRequiredField(formData, "name");
  const domainId = formData.get("domainId");

  if (typeof domainId !== "string") {
    return NextResponse.json({ error: "domainId is required" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.redirect(
      new URL(`/domains/${domainId}/subjects/${subjectId}?error=subject-name`, request.url),
      { status: 303 },
    );
  }

  try {
    await getSyllabusRepository().updateSubject(subjectId, { name });
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
