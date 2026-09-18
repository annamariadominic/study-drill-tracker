import { NextRequest, NextResponse } from "next/server";
import { getRequiredField } from "@/lib/http/form";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const { domainId } = await params;
  const repo = getSyllabusRepository();

  const domain = await repo.getDomain(domainId);
  if (!domain) {
    return NextResponse.json({ error: `Domain not found: ${domainId}` }, { status: 404 });
  }

  const formData = await request.formData();
  const name = getRequiredField(formData, "name");

  if (!name) {
    return NextResponse.redirect(
      new URL(`/domains/${domainId}?error=subject-name`, request.url),
      { status: 303 },
    );
  }

  const subject = await repo.createSubject(domainId, { name });
  return NextResponse.redirect(
    new URL(`/domains/${domainId}/subjects/${subject.id}`, request.url),
    { status: 303 },
  );
}
