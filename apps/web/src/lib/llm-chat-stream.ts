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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSseChunk(line: string): unknown {
  try {
    return JSON.parse(line) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(
      `Invalid LLM chat chunk JSON: ${message}; payloadLength=${line.length}`
    );
  }
}

function extractChunkError(chunk: unknown): string | null {
  if (!isRecord(chunk) || !('error' in chunk)) return null;
  const { error } = chunk;
  if (typeof error === 'string') return error;
  if (!isRecord(error)) return 'LLM chat error';
  return typeof error.message === 'string' ? error.message : 'LLM chat error';
}

function extractChunkText(chunk: unknown): string {
  if (!isRecord(chunk) || !Array.isArray(chunk.choices)) return '';
  const [choice] = chunk.choices;
  if (!isRecord(choice) || !isRecord(choice.delta)) return '';
  return typeof choice.delta.content === 'string' ? choice.delta.content : '';
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
  const text = extractChunkText(chunk);
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
