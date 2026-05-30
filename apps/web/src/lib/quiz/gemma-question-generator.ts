import { z } from 'zod';
import {
  getAiChatModel,
  getLlmChatModel,
  getLlmServerBearer,
  getLlmServerUrl,
  getOllamaBaseUrl,
  getOllamaBasicAuth,
} from '@/env';
import { buildLlmBearerAuthHeader } from '@/lib/llm-auth';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';
import {
  type GemmaQuestionCompletionMessage,
  requestGemmaQuestionCompletion,
} from '@/lib/quiz/gemma-question-completion';
import {
  type GeneratedQuizQuestion,
  generatedQuizOptionSchema,
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

const MIN_COMPLETION_TOKENS = 2400;
const MAX_COMPLETION_TOKENS = 8192;
const COMPLETION_TOKENS_PER_QUESTION = 220;
const TEMPERATURE = 0.35;
const GEMMA_TIMEOUT_MS = 90_000;
const DEFAULT_OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'];

export class QuizQuestionGenerationUnavailableError extends Error {
  constructor() {
    super('Gemma quiz question generation is not configured');
    this.name = 'QuizQuestionGenerationUnavailableError';
  }
}

function stripJsonFence(content: string): string {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function getFallbackOptionId(index: number): string {
  return DEFAULT_OPTION_IDS[index] ?? String(index + 1);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getStringField(
  value: Record<string, unknown>,
  field: string
): string | undefined {
  const candidate = value[field];
  return typeof candidate === 'string' ? candidate.trim() : undefined;
}

function normalizeGeneratedOptions(options: unknown): unknown {
  if (!Array.isArray(options)) return options;

  return options.map((option, index) => {
    const fallbackId = getFallbackOptionId(index);

    if (typeof option === 'string') {
      return { id: fallbackId, label: option.trim() };
    }

    if (!isObjectRecord(option)) return option;

    const id = getStringField(option, 'id') || fallbackId;
    const label =
      getStringField(option, 'label') ||
      getStringField(option, 'text') ||
      getStringField(option, 'value');

    return {
      ...option,
      id,
      label: label ?? option.label,
    };
  });
}

function getOptionIdFromOrdinal(
  rawOrdinal: number,
  options: GeneratedQuizQuestion['options']
): string | undefined {
  if (!Number.isInteger(rawOrdinal)) return undefined;

  const oneBasedIndex = rawOrdinal - 1;
  if (oneBasedIndex >= 0 && oneBasedIndex < options.length) {
    return options[oneBasedIndex]?.id;
  }

  if (rawOrdinal === 0) {
    return options[0]?.id;
  }

  return undefined;
}

function normalizeCorrectOptionId(
  correctOptionId: unknown,
  options: GeneratedQuizQuestion['options']
): unknown {
  if (typeof correctOptionId === 'number') {
    return getOptionIdFromOrdinal(correctOptionId, options) ?? correctOptionId;
  }

  if (typeof correctOptionId !== 'string') return correctOptionId;

  const trimmed = correctOptionId.trim();
  if (options.some((option) => option.id === trimmed)) return trimmed;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return getOptionIdFromOrdinal(numeric, options) ?? trimmed;
  }

  return trimmed;
}

function normalizeGeneratedQuestionPayload(payload: unknown): unknown {
  if (!isObjectRecord(payload) || !Array.isArray(payload.questions)) {
    return payload;
  }

  return {
    ...payload,
    questions: payload.questions.map((question) => {
      if (!isObjectRecord(question)) return question;

      const normalizedOptions = normalizeGeneratedOptions(question.options);
      const parsedOptions = z
        .array(generatedQuizOptionSchema)
        .safeParse(normalizedOptions);
      const optionsForCorrectAnswer = parsedOptions.success
        ? parsedOptions.data
        : [];

      return {
        ...question,
        correctOptionId: normalizeCorrectOptionId(
          question.correctOptionId,
          optionsForCorrectAnswer
        ),
        options: normalizedOptions,
      };
    }),
  };
}

function parseGeneratedContent(content: unknown): GeneratedQuizQuestion[] {
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Gemma returned an empty quiz generation response');
  }

  const parsedJson = normalizeGeneratedQuestionPayload(
    JSON.parse(stripJsonFence(content)) as unknown
  );
  const parsed = generatedQuizQuestionsSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error('Gemma returned invalid quiz question JSON');
  }

  return parsed.data.questions;
}

function buildUserPrompt(input: GenerateQuizQuestionsOptions): string {
  const promptPayload = {
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
  };

  return JSON.stringify(promptPayload, null, 2);
}

function getCompletionTokenBudget(input: GenerateQuizQuestionsOptions): number {
  const totalQuestions = input.topics.length * input.questionCountPerTopic;
  return Math.min(
    MAX_COMPLETION_TOKENS,
    Math.max(
      MIN_COMPLETION_TOKENS,
      totalQuestions * COMPLETION_TOKENS_PER_QUESTION
    )
  );
}

function getGemmaQuestionTransportConfig() {
  const llmServerUrl = getLlmServerUrl();
  if (llmServerUrl) {
    const llmServerBearer = getLlmServerBearer();
    if (!llmServerBearer || !buildLlmBearerAuthHeader(llmServerBearer)) {
      throw new QuizQuestionGenerationUnavailableError();
    }
    return { llmServerUrl, llmServerBearer, model: getLlmChatModel() };
  }

  const ollamaBaseUrl = getOllamaBaseUrl();
  if (!ollamaBaseUrl) {
    throw new QuizQuestionGenerationUnavailableError();
  }

  const ollamaBasicAuth = getOllamaBasicAuth();
  if (ollamaBasicAuth && !buildOllamaBasicAuthHeader(ollamaBasicAuth)) {
    throw new QuizQuestionGenerationUnavailableError();
  }

  return { model: getAiChatModel(), ollamaBaseUrl, ollamaBasicAuth };
}

export async function generateQuizQuestionsWithGemma(
  input: GenerateQuizQuestionsOptions
): Promise<GeneratedQuizQuestion[]> {
  const transportConfig = getGemmaQuestionTransportConfig();
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), GEMMA_TIMEOUT_MS);
  const messages: GemmaQuestionCompletionMessage[] = [
    {
      role: 'system',
      content:
        'You are a quiz question writer for Baci merchants. Return strict JSON with a questions array. Each question needs topic, difficulty, prompt, options, correctOptionId, and explanation. Options must be objects shaped like {"id":"a","label":"Answer"} and correctOptionId must be an option id string.',
    },
    {
      role: 'user',
      content: buildUserPrompt(input),
    },
  ];

  try {
    const content = await requestGemmaQuestionCompletion({
      ...transportConfig,
      signal: abortController.signal,
      maxTokens: getCompletionTokenBudget(input),
      messages,
      temperature: TEMPERATURE,
    });
    return parseGeneratedContent(content);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Gemma quiz generation timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
