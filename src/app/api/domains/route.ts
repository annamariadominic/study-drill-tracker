import { NextRequest, NextResponse } from "next/server";
import { getRequiredField } from "@/lib/http/form";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const name = getRequiredField(formData, "name");

  if (!name) {
    return NextResponse.redirect(new URL("/domains?error=domain-name", request.url), {
      status: 303,
    });
  }

  const domain = await getSyllabusRepository().createDomain({ name });
  return NextResponse.redirect(new URL(`/domains/${domain.id}`, request.url), { status: 303 });
}
