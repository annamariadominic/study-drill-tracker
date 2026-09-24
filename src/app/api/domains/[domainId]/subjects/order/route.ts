import { NextRequest } from "next/server";
import { reorderResponse } from "@/lib/http/reorder";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

/** Replaces the order of a Domain's Subjects. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const { domainId } = await params;
  return reorderResponse(request, "subjectIds", (ids) => getSyllabusRepository().reorderSubjects(domainId, ids));
}
