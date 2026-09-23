import type { GenerateQuestionInput, GeneratedQuestion, GradedAnswer, LlmPort } from "./port";

function defaultGenerateQuestion(input: GenerateQuestionInput): GeneratedQuestion {
  const names = input.concepts.map((concept) => concept.name);
  if (input.type === "scenario") {
    return { type: "scenario", prompt: `Design a system that needs ${names.join(", ")}.` };
  }
  if (input.type === "recall") {
    return { type: "recall", prompt: `Explain ${names[0]}.` };
  }
  return {
    type: "flashcard",
    prompt: `Which of these best describes ${names[0]}?`,
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

  async generateQuestion(input: GenerateQuestionInput): Promise<GeneratedQuestion> {
    this.generateQuestionCallCount += 1;
    return this.generateQuestionImpl(input);
  }

  async gradeAnswer(input: { prompt: string; submittedAnswer: string }): Promise<GradedAnswer> {
    this.gradeAnswerCallCount += 1;
    return this.gradeAnswerImpl(input);
  }
}
