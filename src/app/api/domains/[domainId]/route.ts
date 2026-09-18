import { NextRequest, NextResponse } from "next/server";
import { getRequiredField } from "@/lib/http/form";
import { NotFoundError } from "@/lib/syllabus/errors";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const { domainId } = await params;
  const formData = await request.formData();
  const name = getRequiredField(formData, "name");

  if (!name) {
    return NextResponse.redirect(
      new URL(`/domains/${domainId}?error=domain-name`, request.url),
      { status: 303 },
    );
  }

  try {
    await getSyllabusRepository().updateDomain(domainId, { name });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }

  return NextResponse.redirect(new URL(`/domains/${domainId}`, request.url), { status: 303 });
}
