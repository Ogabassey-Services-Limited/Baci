import type { ModelMessage } from 'ai';
import { generateTextWithChain } from '@/ai/generate-text-with-chain';
import { getTextProviderChain } from '@/ai/text-provider-chain';
import { AGENTIC_SYSTEM_PROMPT } from '@/config/agentic-chat-system-prompt';
import { createAiSdkAgenticChatTools } from './chat-tool-runtime';
import { CUSTOMER_CHAT_TIMEOUT_MS } from './route-helpers';

const GEMINI_PROVIDER_PREFIX = 'google:';
const GEMINI_PROVIDER_TIMEOUT_MS = 25_000;

/**
 * Runs the native-tool Gemini fallback for customer chat.
 *
 * The first rollout is deliberately Gemini-only. Cerebras/Groq are already in
 * the platform text chain, but their agentic tool-call behavior still needs a
 * provider-specific smoke test before a commerce side effect is allowed to
 * cross that boundary. Flash-Lite is a separate Gemini quota pool and is safe
 * to use as the immediate fallback for the existing Flash path.
 */
export async function runChatProviderChain({
  abortSignal,
  messages,
  sessionId,
}: {
  abortSignal: AbortSignal;
  messages: ModelMessage[];
  sessionId: string;
}) {
  let sideEffectExecuted = false;
  const tools = createAiSdkAgenticChatTools(sessionId, {
    onSideEffect: () => {
      sideEffectExecuted = true;
    },
  });

  const geminiChain = getTextProviderChain().filter((provider) =>
    provider.name.startsWith(GEMINI_PROVIDER_PREFIX)
  );

  const result = await generateTextWithChain({
    abortSignal,
    chain: geminiChain,
    messages,
    onProviderError: (providerName, error) => {
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
    },
    overallTimeoutMs: CUSTOMER_CHAT_TIMEOUT_MS,
    perProviderTimeoutMs: GEMINI_PROVIDER_TIMEOUT_MS,
    shouldStopWalk: () => sideEffectExecuted,
    system: AGENTIC_SYSTEM_PROMPT,
    tools,
  });

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
