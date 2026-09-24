import { NextRequest, NextResponse } from "next/server";
import { InvalidOrderError, NotFoundError } from "@/lib/syllabus/errors";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

/**
 * Replaces the order of a Domain's Subjects. Takes JSON rather than a form
 * post because only the drag-to-reorder list, which needs JavaScript anyway,
 * calls it. The database is the authority on whether the order is valid.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const { domainId } = await params;

  const body: unknown = await request.json().catch(() => null);
  const subjectIds = (body as { subjectIds?: unknown } | null)?.subjectIds;
  if (!Array.isArray(subjectIds) || !subjectIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "subjectIds must be an array of Subject ids" }, { status: 400 });
  }

  try {
    await getSyllabusRepository().reorderSubjects(domainId, subjectIds);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    // Most likely a stale list, e.g. a Subject was added in another tab.
    if (error instanceof InvalidOrderError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  return new NextResponse(null, { status: 204 });
}
