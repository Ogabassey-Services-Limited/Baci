import { buildLlmBearerAuthHeader } from '@/lib/llm-auth';
import {
  createLlmTextStream,
  sanitizeLlmUpstreamErrorText,
} from '@/lib/llm-chat-stream';

interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CreateLlmChatResponseOptions {
  baseUrl: string;
  bearer: string;
  model: string;
  messages: LlmChatMessage[];
  signal?: AbortSignal;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
}

const LLM_CHAT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_TEMPERATURE = 0.4;
const MODEL_NAME_LINE_BREAK_PATTERN = /\\n|\r?\n|\r/g;

function buildChatCompletionsUrl(baseUrl: string): string {
  // Parse-then-rewrite the pathname (rather than raw string concat) so query
  // params and fragments survive. A previous implementation concatenated:
  //   `https://host?tenant=a` + `/v1/chat/completions`
  //   -> `https://host?tenant=a/v1/chat/completions` (broken)
  // We also normalize the path to handle the two real-world shapes:
  //   1. Plain host:        `https://host`     -> `/v1/chat/completions`
  //   2. With API prefix:   `https://host/v1`  -> `/v1/chat/completions`
  // Without (2) handling, `https://host/v1` would silently become
  // `https://host/v1/v1/chat/completions` (404), the request fails, and every
  // chat falls back to Gemini — a hard-to-spot misconfiguration.
  const url = new URL(baseUrl);
  const trimmedPath = url.pathname.replace(/\/+$/, '').replace(/\/v1$/i, '');
  url.pathname = `${trimmedPath}/v1/chat/completions`;
  return url.toString();
}

function cleanModelName(model: string): string {
  return model.replace(MODEL_NAME_LINE_BREAK_PATTERN, '').trim();
}

// Distinct DOMException name so the catch handler can tell timeout aborts
// apart from upstream cancellations without relying on a race-prone
// `upstreamSignal?.aborted` check.
const LLM_CHAT_TIMEOUT_REASON_NAME = 'TimeoutError';

function createLlmTimeoutReason(): DOMException {
  return new DOMException(
    'LLM chat request timed out',
    LLM_CHAT_TIMEOUT_REASON_NAME
  );
}

function createAbortSignal(
  upstreamSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(createLlmTimeoutReason()),
    timeoutMs
  );

  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  if (upstreamSignal?.aborted) {
    controller.abort(upstreamSignal.reason);
  } else {
    upstreamSignal?.addEventListener('abort', abortFromUpstream, {
      once: true,
    });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    },
  };
}

function isLlmTimeoutAbort(signal: AbortSignal): boolean {
  return (
    signal.aborted &&
    signal.reason instanceof DOMException &&
    signal.reason.name === LLM_CHAT_TIMEOUT_REASON_NAME
  );
}

/**
 * Streams an OpenAI-compatible chat completion response.
 *
 * Defaults are tuned for customer-support chat: 90s timeout, 500 max tokens,
 * and temperature 0.4. Callers with different latency or creativity needs
 * should pass `timeoutMs`, `maxTokens`, or `temperature` explicitly.
 */
export async function createLlmChatResponse({
  baseUrl,
  bearer,
  model,
  messages,
  signal,
  timeoutMs = LLM_CHAT_TIMEOUT_MS,
  maxTokens = DEFAULT_MAX_TOKENS,
  temperature = DEFAULT_TEMPERATURE,
}: CreateLlmChatResponseOptions): Promise<Response> {
  const authorization = buildLlmBearerAuthHeader(bearer);
  if (!authorization) {
    throw new Error(
      'failed to build Bearer Authorization header from bearer token'
    );
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: authorization,
  };

  const { signal: llmSignal, cleanup } = createAbortSignal(signal, timeoutMs);

  let response: Response;
  try {
    response = await fetch(buildChatCompletionsUrl(baseUrl), {
      method: 'POST',
      headers,
      signal: llmSignal,
      body: JSON.stringify({
        model: cleanModelName(model),
        messages,
        stream: true,
        max_tokens: maxTokens,
        temperature,
      }),
    });
  } catch (error) {
    cleanup();
    if (llmSignal.aborted) {
      if (isLlmTimeoutAbort(llmSignal)) {
        throw new Error('LLM chat request timed out');
      }
      throw new Error('LLM chat request aborted');
    }
    throw error;
  }

  if (!response.ok) {
    try {
      // Swallow body-read errors with `.catch(() => '')`: the upstream status
      // is the load-bearing signal we want to surface. If reading the body
      // fails (network blip, malformed encoding), we still throw a useful
      // `LLM chat returned <status>` rather than masking it with the body
      // error. cleanup() in the finally block ensures the abort timer is
      // cleared either way.
      const rawErrorText = await response.text().catch(() => '');
      const errorText = sanitizeLlmUpstreamErrorText(rawErrorText);
      throw new Error(
        `LLM chat returned ${response.status}${errorText ? `: ${errorText}` : ''}`
      );
    } finally {
      cleanup();
    }
  }

  if (!response.body) {
    cleanup();
    throw new Error('LLM chat returned an empty response body');
  }

  return new Response(createLlmTextStream(response.body, cleanup), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
