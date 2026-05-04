import { buildOllamaBasicAuthHeader } from '@/lib/ollama-auth';

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CreateOllamaChatResponseOptions {
  baseUrl: string;
  model: string;
  messages: OllamaChatMessage[];
  basicAuth?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface OllamaChatChunk {
  message?: {
    content?: string;
  };
  response?: string;
  error?: string;
}

const OLLAMA_CHAT_TIMEOUT_MS = 90_000;
const MODEL_NAME_LINE_BREAK_PATTERN = /\\n|\r?\n|\r/g;

function normalizeOllamaBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '').replace(/\/api$/i, '');
}

function cleanModelName(model: string): string {
  return model.replace(MODEL_NAME_LINE_BREAK_PATTERN, '').trim();
}

function parseOllamaChunk(line: string): OllamaChatChunk {
  try {
    return JSON.parse(line) as OllamaChatChunk;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Invalid Ollama chat chunk JSON: ${message}; payloadLength=${line.length}`
    );
  }
}

// Distinct DOMException name so the catch handler can tell timeout aborts
// apart from upstream cancellations without relying on a race-prone
// `upstreamSignal?.aborted` check.
const OLLAMA_CHAT_TIMEOUT_REASON_NAME = 'TimeoutError';

function createOllamaTimeoutReason(): DOMException {
  return new DOMException(
    'Ollama chat request timed out',
    OLLAMA_CHAT_TIMEOUT_REASON_NAME
  );
}

function createAbortSignal(
  upstreamSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(createOllamaTimeoutReason()),
    timeoutMs
  );

  // Forward the upstream's reason so callers can introspect why the request
  // was cancelled (e.g. user navigation vs. an explicit AbortController call).
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

function isOllamaTimeoutAbort(signal: AbortSignal): boolean {
  return (
    signal.aborted &&
    signal.reason instanceof DOMException &&
    signal.reason.name === OLLAMA_CHAT_TIMEOUT_REASON_NAME
  );
}

function createTextStream(
  body: ReadableStream<Uint8Array>,
  cleanup: () => void
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      let buffer = '';

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let newlineIndex = buffer.indexOf('\n');

          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (line) {
              const chunk = parseOllamaChunk(line);
              if (chunk.error) {
                throw new Error(chunk.error);
              }

              const text = chunk.message?.content ?? chunk.response ?? '';
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            }

            newlineIndex = buffer.indexOf('\n');
          }
        }

        const finalLine = buffer.trim();
        if (finalLine) {
          const chunk = parseOllamaChunk(finalLine);
          if (chunk.error) {
            throw new Error(chunk.error);
          }
          const text = chunk.message?.content ?? chunk.response ?? '';
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        cleanup();
        reader.releaseLock();
      }
    },
  });
}

export async function createOllamaChatResponse({
  baseUrl,
  model,
  messages,
  basicAuth,
  signal,
  timeoutMs = OLLAMA_CHAT_TIMEOUT_MS,
}: CreateOllamaChatResponseOptions): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (basicAuth) {
    const authorization = buildOllamaBasicAuthHeader(basicAuth);
    if (!authorization) {
      throw new Error(
        'failed to build Basic Authorization header from basicAuth'
      );
    }
    headers.Authorization = authorization;
  }

  const { signal: ollamaSignal, cleanup } = createAbortSignal(
    signal,
    timeoutMs
  );

  let response: Response;
  try {
    response = await fetch(`${normalizeOllamaBaseUrl(baseUrl)}/api/chat`, {
      method: 'POST',
      headers,
      signal: ollamaSignal,
      body: JSON.stringify({
        model: cleanModelName(model),
        messages,
        stream: true,
        keep_alive: '10m',
        options: {
          num_ctx: 2048,
          num_predict: 500,
          temperature: 0.4,
        },
      }),
    });
  } catch (error) {
    cleanup();
    // Modern Node (undici) and Chromium reject fetch with the merged
    // signal's abort reason directly — so `error.name` may be the reason's
    // name (e.g. 'TimeoutError'), not the legacy 'AbortError'. Inspect the
    // merged signal first so timeout/upstream cancellations are surfaced
    // with our documented messages instead of leaking the raw DOMException.
    if (ollamaSignal.aborted) {
      if (isOllamaTimeoutAbort(ollamaSignal)) {
        throw new Error('Ollama chat request timed out');
      }
      throw new Error('Ollama chat request aborted');
    }
    throw error;
  }

  if (!response.ok) {
    try {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Ollama chat returned ${response.status}${errorText ? `: ${errorText}` : ''}`
      );
    } finally {
      cleanup();
    }
  }

  if (!response.body) {
    cleanup();
    throw new Error('Ollama chat returned an empty response body');
  }

  return new Response(createTextStream(response.body, cleanup), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
