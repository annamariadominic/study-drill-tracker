import type { GeneratedQuestion, GradedAnswer, LlmPort } from "./port";

function defaultGenerateQuestion(input: {
  conceptName: string;
  conceptNotes: string | null;
  type: "recall" | "flashcard";
}): GeneratedQuestion {
  if (input.type === "recall") {
    return { type: "recall", prompt: `Explain ${input.conceptName}.` };
  }
  return {
    type: "flashcard",
    prompt: `Which of these best describes ${input.conceptName}?`,
    options: ["Correct answer", "Wrong answer A", "Wrong answer B", "Wrong answer C"],
    correctOptionIndex: 0,
  };
}

function defaultGradeAnswer(): GradedAnswer {
  return { correctness: "correct", explanation: "Looks right to me." };
}

export class FakeLlmPort implements LlmPort {
  generateQuestionCallCount = 0;
  gradeAnswerCallCount = 0;

  constructor(
    private readonly generateQuestionImpl: LlmPort["generateQuestion"] = async (input) =>
      defaultGenerateQuestion(input),
    private readonly gradeAnswerImpl: LlmPort["gradeAnswer"] = async () => defaultGradeAnswer(),
  ) {}

  async generateQuestion(input: {
    conceptName: string;
    conceptNotes: string | null;
    type: "recall" | "flashcard";
  }): Promise<GeneratedQuestion> {
    this.generateQuestionCallCount += 1;
    return this.generateQuestionImpl(input);
  }

  async gradeAnswer(input: { prompt: string; submittedAnswer: string }): Promise<GradedAnswer> {
    this.gradeAnswerCallCount += 1;
    return this.gradeAnswerImpl(input);
  }
}
