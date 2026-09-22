import { NextRequest, NextResponse } from "next/server";
import { getLlmPort } from "@/lib/llm/get-port";
import { NotFoundError } from "@/lib/questions/errors";
import { getQuestionsRepository } from "@/lib/questions/get-repository";
import type { Confidence } from "@/lib/questions/types";
import { submitAttempt } from "@/lib/study/submit-attempt";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

const VALID_CONFIDENCES: Confidence[] = ["guessed", "partial", "confident"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const { questionId } = await params;
  const formData = await request.formData();
  const confidence = formData.get("confidence");
  const submittedAnswer = formData.get("submittedAnswer");
  const optionIndexRaw = formData.get("optionIndex");
  const drillIdRaw = formData.get("drillId");
  const drillId =
    typeof drillIdRaw === "string" && drillIdRaw.length > 0
      ? encodeURIComponent(drillIdRaw)
      : null;

  if (typeof confidence !== "string" || !VALID_CONFIDENCES.includes(confidence as Confidence)) {
    return NextResponse.json({ error: "a valid confidence is required" }, { status: 400 });
  }

  const selectedOptionIndex =
    typeof optionIndexRaw === "string" && optionIndexRaw.length > 0
      ? Number.parseInt(optionIndexRaw, 10)
      : undefined;

  try {
    const attempt = await submitAttempt(
      {
        questionsRepo: getQuestionsRepository(),
        syllabusRepo: getSyllabusRepository(),
        llmPort: getLlmPort(),
      },
      {
        questionId,
        confidence: confidence as Confidence,
        submittedAnswer: typeof submittedAnswer === "string" ? submittedAnswer : undefined,
        selectedOptionIndex,
      },
    );
    const answered = drillId
      ? `/study/drills/${drillId}?attemptId=${attempt.id}`
      : `/study/questions/${questionId}?attemptId=${attempt.id}`;
    return NextResponse.redirect(new URL(answered, request.url), { status: 303 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    const failed = drillId
      ? `/study/drills/${drillId}?error=grading-failed`
      : `/study/questions/${questionId}?error=grading-failed`;
    return NextResponse.redirect(new URL(failed, request.url), { status: 303 });
  }
}
