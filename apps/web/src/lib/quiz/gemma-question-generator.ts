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
import { logger } from '@/lib/logger';
import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';
import {
  type GemmaQuestionCompletionMessage,
  requestGemmaQuestionCompletion,
} from '@/lib/quiz/gemma-question-completion';
import {
  buildQuizQuestionPrompt,
  type GenerateQuizQuestionsOptions,
  getQuizQuestionCompletionTokenBudget,
  QUIZ_QUESTION_SYSTEM_PROMPT,
} from '@/lib/quiz/gemma-question-prompt';
import {
  hasHostedQuizQuestionProvider,
  runQuizQuestionProviderChain,
} from '@/lib/quiz/quiz-question-provider-chain';
import {
  type GeneratedQuizQuestion,
  generatedQuizOptionSchema,
  generatedQuizQuestionsSchema,
} from '@/schemas/quiz';

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

/**
 * The SELF-HOSTED transport (our own LLM server, else Ollama). It is now the
 * FALLBACK: the hosted Cerebras Gemma 4 chain is tried first. Returns null when
 * neither is configured, so the caller can decide whether that is fatal — it is
 * only fatal if the hosted chain is also unavailable.
 */
function getSelfHostedTransportConfig() {
  const llmServerUrl = getLlmServerUrl();
  if (llmServerUrl) {
    const llmServerBearer = getLlmServerBearer();
    if (!llmServerBearer || !buildLlmBearerAuthHeader(llmServerBearer)) {
      return null;
    }
    return { llmServerUrl, llmServerBearer, model: getLlmChatModel() };
  }

  const ollamaBaseUrl = getOllamaBaseUrl();
  if (!ollamaBaseUrl) {
    return null;
  }

  const ollamaBasicAuth = getOllamaBasicAuth();
  if (ollamaBasicAuth && !buildOllamaBasicAuthHeader(ollamaBasicAuth)) {
    return null;
  }

  return { model: getAiChatModel(), ollamaBaseUrl, ollamaBasicAuth };
}

/**
 * Generates quiz questions on Gemma 4.
 *
 * Provider order: the HOSTED chain first (Cerebras Gemma 4 → Groq → Gemini →
 * OpenRouter, shared with the AI copilot), then our SELF-HOSTED Gemma server as
 * a last resort. Cerebras serves Gemma 4 in well under a second, and this call
 * blocks the merchant in the dashboard, so it leads.
 *
 * Whatever produces the text, the output is validated by the SAME in-code Zod
 * schema (`parseGeneratedContent` → `generatedQuizQuestionsSchema`), so a
 * provider that returns off-shape JSON is rejected rather than trusted.
 */
export async function generateQuizQuestionsWithGemma(
  input: GenerateQuizQuestionsOptions
): Promise<GeneratedQuizQuestion[]> {
  const hasHostedChain = hasHostedQuizQuestionProvider();
  let selfHostedConfig: ReturnType<typeof getSelfHostedTransportConfig> = null;

  if (!hasHostedChain) {
    selfHostedConfig = getSelfHostedTransportConfig();
    if (!selfHostedConfig) {
      throw new QuizQuestionGenerationUnavailableError();
    }
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), GEMMA_TIMEOUT_MS);
  const userPrompt = buildQuizQuestionPrompt(input);
  const maxOutputTokens = getQuizQuestionCompletionTokenBudget(input);

  try {
    if (hasHostedChain) {
      try {
        const content = await runQuizQuestionProviderChain({
          system: QUIZ_QUESTION_SYSTEM_PROMPT,
          prompt: userPrompt,
          maxOutputTokens,
          temperature: TEMPERATURE,
          abortSignal: abortController.signal,
          parseContent: parseGeneratedContent,
        });
        return content;
      } catch (error) {
        // The whole hosted chain failed (or produced JSON the schema rejected).
        // If we have no self-hosted server to fall back to, this is terminal.
        // Never swallow the route timeout — retrying against a fired signal
        // would just burn the merchant's remaining budget.
        if (abortController.signal.aborted) {
          throw error;
        }

        try {
          selfHostedConfig = getSelfHostedTransportConfig();
        } catch {
          throw error;
        }
        if (!selfHostedConfig) throw error;

        logger.warn({
          event: 'quiz_question_generation',
          message:
            'Hosted Gemma chain failed; falling back to the self-hosted Gemma server',
        });
      }
    }

    if (!selfHostedConfig) {
      throw new QuizQuestionGenerationUnavailableError();
    }

    const messages: GemmaQuestionCompletionMessage[] = [
      { role: 'system', content: QUIZ_QUESTION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const content = await requestGemmaQuestionCompletion({
      ...selfHostedConfig,
      signal: abortController.signal,
      maxTokens: maxOutputTokens,
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
