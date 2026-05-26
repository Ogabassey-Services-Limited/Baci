import { getLlmChatModel, getLlmServerBearer, getLlmServerUrl } from '@/env';
import { buildLlmBearerAuthHeader } from '@/lib/llm-auth';
import {
  type GeneratedQuizQuestion,
  generatedQuizQuestionsSchema,
  type MerchantQuizGenerationInput,
} from '@/schemas/quiz';

type GenerateQuizQuestionsOptions = Pick<
  MerchantQuizGenerationInput,
  'difficulty' | 'questionCountPerTopic' | 'topics'
> & {
  merchantName: string;
  productContext?: string;
};

type ChatCompletionJsonResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
};

const MAX_TOKENS = 2400;
const TEMPERATURE = 0.35;

export class QuizQuestionGenerationUnavailableError extends Error {
  constructor() {
    super('Gemma quiz question generation is not configured');
    this.name = 'QuizQuestionGenerationUnavailableError';
  }
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const trimmedPath = url.pathname.replace(/\/+$/, '').replace(/\/v1$/i, '');
  url.pathname = `${trimmedPath}/v1/chat/completions`;
  return url.toString();
}

function stripJsonFence(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function parseGeneratedContent(content: unknown): GeneratedQuizQuestion[] {
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Gemma returned an empty quiz generation response');
  }

  const parsedJson = JSON.parse(stripJsonFence(content)) as unknown;
  const parsed = generatedQuizQuestionsSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error('Gemma returned invalid quiz question JSON');
  }

  return parsed.data.questions;
}

function buildUserPrompt(input: GenerateQuizQuestionsOptions): string {
  return JSON.stringify(
    {
      difficulty: input.difficulty,
      instructions: [
        'Generate multiple-choice questions for a merchant prize quiz.',
        'Use only concise factual questions that can be answered from common product knowledge.',
        'Return JSON only. No markdown.',
      ],
      merchantName: input.merchantName,
      productContext: input.productContext ?? null,
      questionCountPerTopic: input.questionCountPerTopic,
      topics: input.topics,
    },
    null,
    2
  );
}

export async function generateQuizQuestionsWithGemma(
  input: GenerateQuizQuestionsOptions
): Promise<GeneratedQuizQuestion[]> {
  const baseUrl = getLlmServerUrl();
  const bearer = getLlmServerBearer();
  if (!baseUrl || !bearer) {
    throw new QuizQuestionGenerationUnavailableError();
  }

  const authorization = buildLlmBearerAuthHeader(bearer);
  if (!authorization) {
    throw new QuizQuestionGenerationUnavailableError();
  }

  const response = await fetch(buildChatCompletionsUrl(baseUrl), {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: 'system',
          content:
            'You are a quiz question writer for Baci merchants. Return strict JSON with a questions array. Each question needs topic, difficulty, prompt, options, correctOptionId, and explanation.',
        },
        {
          role: 'user',
          content: buildUserPrompt(input),
        },
      ],
      model: getLlmChatModel(),
      response_format: { type: 'json_object' },
      stream: false,
      temperature: TEMPERATURE,
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemma quiz generation failed with ${response.status}`);
  }

  const payload = (await response.json()) as ChatCompletionJsonResponse;
  const content = payload.choices?.[0]?.message?.content;
  return parseGeneratedContent(content);
}
