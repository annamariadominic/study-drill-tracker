import { after, NextRequest, NextResponse } from "next/server";
import { getLlmPort } from "@/lib/llm/get-port";
import { NotFoundError } from "@/lib/questions/errors";
import { getQuestionsRepository } from "@/lib/questions/get-repository";
import type { Confidence } from "@/lib/questions/types";
import { gradeAttempt, submitAttempt } from "@/lib/study/submit-attempt";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

/**
 * A free-text answer is graded after the response has gone (ADR 0011), which
 * this bounds. Grading usually takes 4–8 s; the rest is room for a slow or
 * retried LLM call to finish, and so mark the Attempt failed rather than
 * leave it pending.
 */
export const maxDuration = 300;

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

  // An Attempt made inside a Drill returns to the Drill; a one-off Question
  // returns to its own page.
  const returnUrl = (query: string) =>
    drillId ? `/study/drills/${drillId}?${query}` : `/study/questions/${questionId}?${query}`;

  const selectedOptionIndex =
    typeof optionIndexRaw === "string" && optionIndexRaw.length > 0
      ? Number.parseInt(optionIndexRaw, 10)
      : undefined;

  const deps = { questionsRepo: getQuestionsRepository(), syllabusRepo: getSyllabusRepository() };

  try {
    const attempt = await submitAttempt(deps, {
      questionId,
      confidence: confidence as Confidence,
      submittedAnswer: typeof submittedAnswer === "string" ? submittedAnswer : undefined,
      selectedOptionIndex,
    });
    if (attempt.gradingStatus === "pending") {
      // The learner goes straight to their feedback, which fills in once this
      // has graded the answer.
      after(() => gradeAttempt({ ...deps, llmPort: getLlmPort() }, attempt.id));
    }
    return NextResponse.redirect(new URL(returnUrl(`attemptId=${attempt.id}`), request.url), {
      status: 303,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.redirect(new URL(returnUrl("error=submit-failed"), request.url), {
      status: 303,
    });
  }
}
