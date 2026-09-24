import { NextRequest, NextResponse } from "next/server";
import { getDrillsRepository } from "@/lib/drills/get-repository";
import { MixedDomainsError, NoStudiedConceptsError } from "@/lib/drills/errors";
import { startRandomDrill } from "@/lib/drills/start-random-drill";
import type { RandomDrillScope } from "@/lib/drills/types";
import { getRequiredField } from "@/lib/http/form";
import { getLlmPort } from "@/lib/llm/get-port";
import { getQuestionsRepository } from "@/lib/questions/get-repository";
import { ConceptNotStudiedError } from "@/lib/study/errors";
import { NotFoundError } from "@/lib/syllabus/errors";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

/** Back to the random Drill page with a message, on the scope the form was submitted from. */
function redirectWithError(request: NextRequest, error: string, scopeKind: RandomDrillScope["kind"]) {
  return NextResponse.redirect(new URL(`/study/random?scope=${scopeKind}&error=${error}`, request.url), {
    status: 303,
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const kind = formData.get("kind");

  // Malformed requests get a JSON error; anything a user can reach from the
  // page (including a page gone stale) redirects back to it with a message.
  let scope: RandomDrillScope;
  if (kind === null || kind === "library") {
    // Unscoped means the whole library.
    scope = { kind: "library" };
  } else if (kind === "subject") {
    const subjectId = getRequiredField(formData, "subjectId");
    if (!subjectId) {
      return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
    }
    scope = { kind: "subject", subjectId };
  } else if (kind === "concepts") {
    const conceptIds = formData
      .getAll("conceptId")
      .filter((conceptId): conceptId is string => typeof conceptId === "string" && conceptId.length > 0);
    if (conceptIds.length === 0) {
      return redirectWithError(request, "no-concepts-picked", "concepts");
    }
    scope = { kind: "concepts", conceptIds };
  } else {
    return NextResponse.json({ error: "kind must be library, subject or concepts" }, { status: 400 });
  }

  try {
    const drill = await startRandomDrill(
      {
        syllabusRepo: getSyllabusRepository(),
        drillsRepo: getDrillsRepository(),
        questionsRepo: getQuestionsRepository(),
        llmPort: getLlmPort(),
      },
      { scope },
    );
    return NextResponse.redirect(new URL(`/study/drills/${drill.id}`, request.url), {
      status: 303,
    });
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ConceptNotStudiedError) {
      return redirectWithError(request, "scope-changed", scope.kind);
    }
    if (error instanceof NoStudiedConceptsError) {
      return redirectWithError(request, "nothing-studied", scope.kind);
    }
    if (error instanceof MixedDomainsError) {
      return redirectWithError(request, "mixed-domains", scope.kind);
    }
    return redirectWithError(request, "drill-generation-failed", scope.kind);
  }
}
