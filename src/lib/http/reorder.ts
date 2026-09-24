import { NextResponse } from "next/server";
import { InvalidOrderError, NotFoundError } from "@/lib/syllabus/errors";

/**
 * Handles a drag-to-reorder save: reads the full ordered list of ids from the
 * JSON body under `idsKey` and hands it to `reorder`. The route takes JSON
 * rather than a form post because only the sortable list, which needs
 * JavaScript anyway, calls it. The database is the authority on whether the
 * order is valid; this only checks the body's shape.
 */
export async function reorderResponse(
  request: Request,
  idsKey: string,
  reorder: (ids: string[]) => Promise<void>,
): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const ids = (body as Record<string, unknown> | null)?.[idsKey];
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: `${idsKey} must be an array of ids` }, { status: 400 });
  }

  try {
    await reorder(ids);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    // Most likely a stale list, e.g. an item was added in another tab.
    if (error instanceof InvalidOrderError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  return new NextResponse(null, { status: 204 });
}
