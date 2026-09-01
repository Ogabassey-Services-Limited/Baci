import type { ModelMessage } from 'ai';
import {
  type ChainTextResult,
  generateTextWithChain,
} from '@/ai/generate-text-with-chain';
import { getTextProviderChain } from '@/ai/text-provider-chain';
import { AGENTIC_SYSTEM_PROMPT } from '@/config/agentic-chat-system-prompt';
import { createAiSdkAgenticChatTools } from './chat-tool-runtime';
import { CUSTOMER_CHAT_TIMEOUT_MS } from './route-helpers';

const GEMINI_PROVIDER_PREFIX = 'google:';
const GEMINI_PROVIDER_TIMEOUT_MS = 25_000;
const TEXT_ONLY_FALLBACK_SYSTEM_PROMPT =
  "You are Ogabassey's shopping assistant. Keep replies brief, helpful, and honest. " +
  'You do not have access to live inventory, current prices, checkout actions, orders, or payment status in this recovery mode. ' +
  'Never claim that you searched stock, added an item, generated a bank account, confirmed payment, or cancelled an order. ' +
  'For current availability, pricing, checkout, or payments, direct the customer to the storefront or WhatsApp support.';

/**
 * Runs the native-tool Gemini fallback for customer chat.
 *
 * Gemini owns the tool-capable fallback because Cerebras/Groq still need a
 * provider-specific agentic smoke test before a commerce side effect is
 * allowed to cross that boundary. If both Gemini pools fail before any
 * side-effecting tool runs, configured reliable providers get a final,
 * explicitly toolless recovery attempt for general conversation. This keeps
 * commerce actions fail-safe while avoiding a static response whenever the
 * Gemini quota is exhausted.
 */
export async function runChatProviderChain({
  abortSignal,
  messages,
  sessionId,
}: {
  abortSignal: AbortSignal;
  messages: ModelMessage[];
  sessionId: string;
}): Promise<ChainTextResult> {
  let sideEffectExecuted = false;
  const tools = createAiSdkAgenticChatTools(sessionId, {
    onSideEffect: () => {
      sideEffectExecuted = true;
    },
  });

  const providerChain = getTextProviderChain();
  const geminiChain = providerChain.filter((provider) =>
    provider.name.startsWith(GEMINI_PROVIDER_PREFIX)
  );
  const toollessFallbackChain = providerChain.filter(
    (provider) =>
      !provider.name.startsWith(GEMINI_PROVIDER_PREFIX) &&
      !provider.opportunistic
  );
  const deadline = Date.now() + CUSTOMER_CHAT_TIMEOUT_MS;
  const remainingTimeoutMs = () => Math.max(0, deadline - Date.now());
  const onProviderError = (providerName: string, error: unknown) => {
    const errorName =
      error instanceof Error ? error.name.slice(0, 80) : 'UnknownError';
    console.warn(
      'agentic_chat_provider',
      JSON.stringify({
        errorName,
        event: 'provider_error',
        provider: providerName,
        surface: 'agentic_chat',
      })
    );
  };

  let result: ChainTextResult | undefined;
  let geminiError: unknown;
  try {
    result = await generateTextWithChain({
      abortSignal,
      chain: geminiChain,
      messages,
      onProviderError,
      overallTimeoutMs: remainingTimeoutMs(),
      perProviderTimeoutMs: GEMINI_PROVIDER_TIMEOUT_MS,
      shouldStopWalk: () => sideEffectExecuted,
      system: AGENTIC_SYSTEM_PROMPT,
      tools,
    });
  } catch (error) {
    geminiError = error;
  }

  if (result) {
    console.info(
      'agentic_chat_provider',
      JSON.stringify({
        event: 'provider_success',
        provider: result.providerName,
        surface: 'agentic_chat',
      })
    );
    return result;
  }

  // Never replay a commerce action on a provider that has not passed the
  // agentic-tool smoke test. The route's static fallback remains the safe
  // response when a side effect already happened and the tool-capable model
  // could not produce its final text.
  if (sideEffectExecuted || toollessFallbackChain.length === 0) {
    throw geminiError ?? new Error('Gemini chat provider chain failed');
  }

  const fallbackTimeoutMs = remainingTimeoutMs();
  if (fallbackTimeoutMs <= 0) {
    throw geminiError ?? new Error('Gemini chat provider chain failed');
  }

  try {
    const fallbackResult = await generateTextWithChain({
      abortSignal,
      chain: toollessFallbackChain,
      messages,
      onProviderError,
      overallTimeoutMs: fallbackTimeoutMs,
      perProviderTimeoutMs: GEMINI_PROVIDER_TIMEOUT_MS,
      system: TEXT_ONLY_FALLBACK_SYSTEM_PROMPT,
    });

    console.info(
      'agentic_chat_provider',
      JSON.stringify({
        event: 'provider_success',
        provider: fallbackResult.providerName,
        surface: 'agentic_chat',
      })
    );
    return fallbackResult;
  } catch (fallbackError) {
    // Preserve the original Gemini-chain error when the recovery chain is
    // unavailable; it contains the actionable quota/configuration reason and
    // avoids widening the route's logged provider-error surface.
    if (geminiError) {
      throw geminiError;
    }
    throw fallbackError;
  }
}
