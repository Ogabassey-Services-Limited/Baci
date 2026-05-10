import { buildLlmBearerAuthHeader } from '@/lib/llm-auth';

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

interface OpenAiChatChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
  error?: { message?: string } | string;
}

const LLM_CHAT_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_TEMPERATURE = 0.4;
const ERROR_TEXT_MAX_CHARS = 200;
const MODEL_NAME_LINE_BREAK_PATTERN = /\\n|\r?\n|\r/g;
const SSE_DONE_SENTINEL = '[DONE]';

function sanitizeUpstreamErrorText(raw: string): string {
  // Strip newlines and truncate before surfacing upstream error bodies in our thrown Error —
  // a misconfigured llama-server can return verbose HTML/stack traces; we only need a hint.
  const flat = raw.replace(/\s+/g, ' ').trim();
  if (flat.length <= ERROR_TEXT_MAX_CHARS) {
    return flat;
  }
  return `${flat.slice(0, ERROR_TEXT_MAX_CHARS)}…`;
}

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

function parseSseChunk(line: string): OpenAiChatChunk {
  try {
    return JSON.parse(line) as OpenAiChatChunk;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Invalid LLM chat chunk JSON: ${message}; payloadLength=${line.length}`
    );
  }
}

function extractChunkError(chunk: OpenAiChatChunk): string | null {
  if (!chunk.error) return null;
  if (typeof chunk.error === 'string') return chunk.error;
  return chunk.error.message ?? 'LLM chat error';
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

function processSseLine(
  line: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
): boolean {
  // Returns true when a [DONE] sentinel was observed and the stream should end.
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return false;

  const payload = trimmed.slice('data:'.length).trim();
  if (!payload) return false;
  if (payload === SSE_DONE_SENTINEL) return true;

  const chunk = parseSseChunk(payload);
  const errorMessage = extractChunkError(chunk);
  if (errorMessage) {
    throw new Error(sanitizeUpstreamErrorText(errorMessage));
  }
  const text = chunk.choices?.[0]?.delta?.content ?? '';
  if (text) {
    controller.enqueue(encoder.encode(text));
  }
  return false;
}

function createTextStream(
  body: ReadableStream<Uint8Array>,
  cleanup: () => void
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let cleanupDone = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const cleanupOnce = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    cleanup();
  };

  const cancelUpstream = async () => {
    await reader?.cancel().catch(() => undefined);
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      reader = body.getReader();
      let buffer = '';
      let done = false;
      let shouldCancelUpstream = false;

      try {
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          if (readerDone) break;

          buffer += decoder.decode(value, { stream: true });
          let newlineIndex = buffer.indexOf('\n');

          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (processSseLine(line, controller, encoder)) {
              done = true;
              shouldCancelUpstream = true;
              break;
            }

            newlineIndex = buffer.indexOf('\n');
          }
        }

        if (!done && buffer.trim()) {
          // Capture the [DONE] return for parity with the main loop, even
          // though we're already at end-of-stream — keeps semantics
          // consistent if a server emits "data: [DONE]\n" without a
          // trailing newline.
          done = processSseLine(buffer, controller, encoder);
          shouldCancelUpstream = done;
        }

        controller.close();
      } catch (error) {
        shouldCancelUpstream = true;
        controller.error(error);
      } finally {
        if (shouldCancelUpstream) {
          await cancelUpstream();
        }
        reader?.releaseLock();
        reader = null;
        cleanupOnce();
      }
    },
    async cancel() {
      await cancelUpstream();
      cleanupOnce();
    },
  });
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
      const errorText = sanitizeUpstreamErrorText(rawErrorText);
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

  return new Response(createTextStream(response.body, cleanup), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
