import type { MerchantQuizGenerationInput } from '@/schemas/quiz';

export type GenerateQuizQuestionsOptions = Pick<
  MerchantQuizGenerationInput,
  'difficulty' | 'questionCountPerTopic' | 'topics'
> & {
  merchantName: string;
  productContext?: string;
};

const MIN_COMPLETION_TOKENS = 2400;
const MAX_COMPLETION_TOKENS = 8192;
const COMPLETION_TOKENS_PER_QUESTION = 220;

export const QUIZ_QUESTION_SYSTEM_PROMPT =
  'You are a quiz question writer for Baci merchants. Return strict JSON with a questions array. Each question needs topic, difficulty, prompt, options, correctOptionId, and explanation. Options must be objects shaped like {"id":"a","label":"Answer"} and correctOptionId must be an option id string.';

export function buildQuizQuestionPrompt(
  input: GenerateQuizQuestionsOptions
): string {
  return JSON.stringify(
    {
      difficulty: input.difficulty,
      instructions: [
        'Generate multiple-choice questions for a merchant prize quiz.',
        'Use only concise factual questions that can be answered from common product knowledge.',
        'Each option must be an object with id and label fields; never return options as plain strings.',
        'Use option ids "a", "b", "c", and "d"; correctOptionId must be the matching id string, never a number.',
        'Return JSON only. No markdown.',
      ],
      requiredJsonShape: {
        questions: [
          {
            correctOptionId: 'a',
            difficulty: input.difficulty,
            explanation: 'Short explanation for the correct answer.',
            options: [
              { id: 'a', label: 'First answer' },
              { id: 'b', label: 'Second answer' },
              { id: 'c', label: 'Third answer' },
              { id: 'd', label: 'Fourth answer' },
            ],
            prompt: 'Question text?',
            topic: input.topics[0],
          },
        ],
      },
      merchantName: input.merchantName,
      ...(input.productContext != null
        ? { productContext: input.productContext }
        : {}),
      questionCountPerTopic: input.questionCountPerTopic,
      topics: input.topics,
    },
    null,
    2
  );
}

export function getQuizQuestionCompletionTokenBudget(
  input: GenerateQuizQuestionsOptions
): number {
  const totalQuestions = input.topics.length * input.questionCountPerTopic;
  return Math.min(
    MAX_COMPLETION_TOKENS,
    Math.max(
      MIN_COMPLETION_TOKENS,
      totalQuestions * COMPLETION_TOKENS_PER_QUESTION
    )
  );
}
