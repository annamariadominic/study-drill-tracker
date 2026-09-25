import { after, NextRequest, NextResponse } from "next/server";
import { getLlmPort } from "@/lib/llm/get-port";
import { NotFoundError } from "@/lib/questions/errors";
import { getQuestionsRepository } from "@/lib/questions/get-repository";
import { GradingNotFailedError } from "@/lib/study/errors";
import { feedbackPath } from "@/lib/study/grading";
import { gradeAttempt, retryGrading } from "@/lib/study/submit-attempt";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";

/** As for the attempts route: a retried grade runs after the response, within GRADING_TIME_LIMIT_MS. */
export const maxDuration = 300;

/** Where an Attempt's grading has got to, polled by its feedback screen until it's no longer pending. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const attempt = await getQuestionsRepository().getAttempt(attemptId);
  if (!attempt) {
    return NextResponse.json({ error: new NotFoundError("Attempt", attemptId).message }, { status: 404 });
  }
  return NextResponse.json({ gradingStatus: attempt.gradingStatus }, { headers: { "cache-control": "no-store" } });
}

/**
 * Retries a failed (or stalled) grade: the Attempt goes back to pending, the
 * learner back to its feedback, and the grading runs again after the response.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const questionsRepo = getQuestionsRepository();

  const attempt = await questionsRepo.getAttempt(attemptId);
  const question = attempt ? await questionsRepo.getQuestion(attempt.questionId) : null;
  if (!attempt || !question) {
    return NextResponse.json({ error: new NotFoundError("Attempt", attemptId).message }, { status: 404 });
  }

  try {
    await retryGrading({ questionsRepo }, attempt.id);
    after(() =>
      gradeAttempt({ questionsRepo, syllabusRepo: getSyllabusRepository(), llmPort: getLlmPort() }, attempt.id),
    );
  } catch (error) {
    // Still grading, or graded (a second click, say): the feedback shows where it's got to.
    if (!(error instanceof GradingNotFailedError)) {
      throw error;
    }
  }

  return NextResponse.redirect(new URL(feedbackPath(question, attempt.id), request.url), { status: 303 });
}
