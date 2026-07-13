import { generateText } from 'ai';
import { getCopilotTextProviderChain } from '@/ai/copilot-provider-chain';
import { logger } from '@/lib/logger';

/**
 * Runs quiz question generation on the HOSTED Gemma chain — Cerebras Gemma 4
 * first, then Groq / Gemini / OpenRouter — reusing the exact provider chain the
 * AI copilot already uses (`getCopilotTextProviderChain`). Cerebras serves
 * Gemma 4 at roughly sub-second latency, which matters here because question
 * generation blocks the merchant in the dashboard.
 *
 * This deliberately returns the RAW model text rather than a parsed object: the
 * caller owns the Zod validation (`generatedQuizQuestionsSchema`), so a model
 * that returns off-shape JSON is rejected by the same in-code schema regardless
 * of which provider produced it.
 *
 * Any failure — quota, 5xx, network, timeout, or empty output — falls through to
 * the next provider. The chain IS the retry, spread across independent
 * infrastructures, so one provider's outage or exhausted free tier never
 * dead-ends the merchant.
 */
export class QuizQuestionProviderChainUnavailableError extends Error {
  constructor() {
    super('No hosted quiz question provider is configured');
    this.name = 'QuizQuestionProviderChainUnavailableError';
  }
}

export interface RunQuizQuestionProviderChainOptions {
  system: string;
  prompt: string;
  maxOutputTokens: number;
  temperature: number;
  abortSignal: AbortSignal;
}

/** True when at least one hosted provider (e.g. Cerebras) has an API key set. */
export function hasHostedQuizQuestionProvider(): boolean {
  return getCopilotTextProviderChain().length > 0;
}

export async function runQuizQuestionProviderChain({
  system,
  prompt,
  maxOutputTokens,
  temperature,
  abortSignal,
}: RunQuizQuestionProviderChainOptions): Promise<string> {
  const providerChain = getCopilotTextProviderChain();

  if (providerChain.length === 0) {
    throw new QuizQuestionProviderChainUnavailableError();
  }

  let lastError: unknown;

  for (const provider of providerChain) {
    try {
      const { text } = await generateText({
        model: provider.model,
        system,
        prompt,
        abortSignal,
        maxOutputTokens,
        temperature,
      });

      const content = text?.trim();
      if (content) {
        return content;
      }

      // An empty completion is a provider failure, not a merchant error — fall
      // through rather than handing the parser something it will reject anyway.
      lastError = new Error(`${provider.name} returned an empty completion`);
      logger.warn({
        event: 'quiz_question_generation',
        message: 'Quiz question provider returned an empty completion',
        provider: provider.name,
      });
    } catch (error) {
      // The route-level timeout aborts every attempt at once. Do not burn the
      // rest of the chain re-trying against a signal that has already fired.
      if (abortSignal.aborted) {
        throw error;
      }

      lastError = error;
      logger.warn({
        error,
        event: 'quiz_question_generation',
        message: 'Quiz question provider failed; falling through to the next',
        provider: provider.name,
      });
    }
  }

  throw (
    lastError ?? new Error('Every quiz question provider failed with no error')
  );
}
