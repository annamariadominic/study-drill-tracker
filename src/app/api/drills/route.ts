import { NextRequest, NextResponse } from "next/server";
import { getDrillsRepository } from "@/lib/drills/get-repository";
import { NoDueConceptsError } from "@/lib/drills/errors";
import { startDueDrill } from "@/lib/drills/start-due-drill";
import { getLlmPort } from "@/lib/llm/get-port";
import { getQuestionsRepository } from "@/lib/questions/get-repository";
import { NotFoundError } from "@/lib/syllabus/errors";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const domainId = formData.get("domainId");

  if (typeof domainId !== "string" || domainId.length === 0) {
    return NextResponse.json({ error: "domainId is required" }, { status: 400 });
  }

  try {
    const drill = await startDueDrill(
      {
        syllabusRepo: getSyllabusRepository(),
        drillsRepo: getDrillsRepository(),
        questionsRepo: getQuestionsRepository(),
        llmPort: getLlmPort(),
      },
      { domainId },
    );
    return NextResponse.redirect(new URL(`/study/drills/${drill.id}`, request.url), {
      status: 303,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof NoDueConceptsError) {
      return NextResponse.redirect(new URL("/study/due?error=nothing-due", request.url), {
        status: 303,
      });
    }
    return NextResponse.redirect(new URL("/study/due?error=drill-generation-failed", request.url), {
      status: 303,
    });
  }
}
