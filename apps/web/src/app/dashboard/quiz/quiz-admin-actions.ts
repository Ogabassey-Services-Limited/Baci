import { apiPost } from '@/lib/api-client';
import {
  type MerchantQuizActivationResponse,
  type MerchantQuizGenerationResponse,
  merchantQuizActivationResponseSchema,
  merchantQuizGenerationResponseSchema,
} from '@/schemas/quiz';

const QUIZ_GENERATE_ENDPOINT = '/api/merchant/quiz/generate';
// Activation is a separate, cheap request; it posts to its own path so it is
// not throttled by the expensive Gemma-generation rate-limit bucket.
const QUIZ_ACTIVATE_ENDPOINT = '/api/merchant/quiz/activate';

export function topicsFromTextarea(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((topic) => topic.trim())
    .filter(Boolean);
}

export function clampNumber(
  value: number,
  minimum: number,
  maximum: number
): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampNumberInput(
  value: string,
  minimum: number,
  maximum: number
): string {
  return String(clampNumber(Number(value), minimum, maximum));
}

export function isQuizDifficulty(
  value: string
): value is 'easy' | 'standard' | 'hard' {
  return value === 'easy' || value === 'standard' || value === 'hard';
}

function formatValidationSummary(
  issues: { message: string; path: PropertyKey[] }[]
): string {
  return issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`)
    .join('; ');
}

export interface GenerateQuizDraftInput {
  difficulty: 'easy' | 'standard' | 'hard';
  prizeProductId: string;
  questionCountPerTopic: number;
  timeLimitSeconds: number;
  title: string;
  topics: string;
}

export async function generateQuizDraft(
  input: GenerateQuizDraftInput
): Promise<MerchantQuizGenerationResponse> {
  const normalizedTopics = topicsFromTextarea(input.topics);
  if (normalizedTopics.length === 0) {
    throw new Error('Add at least one quiz topic before generating.');
  }
  if (!input.prizeProductId) {
    throw new Error('Select an active product prize before generating.');
  }

  const parsed = merchantQuizGenerationResponseSchema.safeParse(
    await apiPost(QUIZ_GENERATE_ENDPOINT, {
      difficulty: input.difficulty,
      prizeProductId: input.prizeProductId,
      questionCountPerTopic: input.questionCountPerTopic,
      timeLimitSeconds: input.timeLimitSeconds,
      title: input.title,
      topics: normalizedTopics,
    })
  );
  if (!parsed.success) {
    const validationSummary = formatValidationSummary(parsed.error.issues);
    console.error('Invalid quiz generation response', parsed.error);
    throw new Error(`Invalid quiz generation response: ${validationSummary}`);
  }
  return parsed.data;
}

export async function activateQuizEvent(
  eventId: string
): Promise<MerchantQuizActivationResponse> {
  const parsed = merchantQuizActivationResponseSchema.safeParse(
    await apiPost(QUIZ_ACTIVATE_ENDPOINT, {
      confirmActivation: true,
      eventId,
    })
  );
  if (!parsed.success) {
    const validationSummary = formatValidationSummary(parsed.error.issues);
    console.error('Invalid quiz activation response', parsed.error);
    throw new Error(`Invalid quiz activation response: ${validationSummary}`);
  }
  return parsed.data;
}
