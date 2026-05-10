interface OpenAiChatChunk {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
  error?: { message?: string } | string;
}

const ERROR_TEXT_MAX_CHARS = 200;
const SSE_DONE_SENTINEL = '[DONE]';

export function sanitizeLlmUpstreamErrorText(raw: string): string {
  // Strip newlines and truncate before surfacing upstream error bodies in our thrown Error.
  const flat = raw.replace(/\s+/g, ' ').trim();
  if (flat.length <= ERROR_TEXT_MAX_CHARS) {
    return flat;
  }
  return `${flat.slice(0, ERROR_TEXT_MAX_CHARS)}…`;
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

function processSseLine(
  line: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder
): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return false;

  const payload = trimmed.slice('data:'.length).trim();
  if (!payload) return false;
  if (payload === SSE_DONE_SENTINEL) return true;

  const chunk = parseSseChunk(payload);
  const errorMessage = extractChunkError(chunk);
  if (errorMessage) {
    throw new Error(sanitizeLlmUpstreamErrorText(errorMessage));
  }
  const text = chunk.choices?.[0]?.delta?.content ?? '';
  if (text) {
    controller.enqueue(encoder.encode(text));
  }
  return false;
}

export function createLlmTextStream(
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
