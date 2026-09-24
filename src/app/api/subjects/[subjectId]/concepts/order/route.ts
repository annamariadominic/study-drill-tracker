import { NextRequest } from "next/server";
import { reorderResponse } from "@/lib/http/reorder";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

/** Replaces the order of a Subject's Concepts. Changes only their order. */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ subjectId: string }> },
) {
  const { subjectId } = await params;
  return reorderResponse(request, "conceptIds", (ids) => getSyllabusRepository().reorderConcepts(subjectId, ids));
}
