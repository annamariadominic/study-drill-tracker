import { NextRequest, NextResponse } from "next/server";
import { getLlmPort } from "@/lib/llm/get-port";
import { getQuestionsRepository } from "@/lib/questions/get-repository";
import type { QuestionType } from "@/lib/questions/types";
import { askQuestion } from "@/lib/study/ask-question";
import { ConceptNotStudiedError } from "@/lib/study/errors";
import { NotFoundError } from "@/lib/syllabus/errors";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

const VALID_TYPES: QuestionType[] = ["recall", "flashcard"];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const conceptId = formData.get("conceptId");
  const type = formData.get("type");

  if (typeof conceptId !== "string" || typeof type !== "string" || !VALID_TYPES.includes(type as QuestionType)) {
    return NextResponse.json({ error: "conceptId and a valid type are required" }, { status: 400 });
  }

  try {
    const question = await askQuestion(
      {
        syllabusRepo: getSyllabusRepository(),
        questionsRepo: getQuestionsRepository(),
        llmPort: getLlmPort(),
      },
      { conceptId, type: type as QuestionType },
    );
    return NextResponse.redirect(new URL(`/study/questions/${question.id}`, request.url), {
      status: 303,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConceptNotStudiedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.redirect(new URL("/study?error=generation-failed", request.url), {
      status: 303,
    });
  }
}
