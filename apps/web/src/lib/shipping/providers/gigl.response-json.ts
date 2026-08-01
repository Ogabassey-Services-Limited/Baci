export interface GiglResponseJsonOptions {
  maxResponseBytes?: number;
  signal?: AbortSignal;
}

const INVALID_MAX_RESPONSE_BYTES =
  'GIGL response maximum size must be a positive safe integer';
const RESPONSE_TOO_LARGE = 'GIGL response exceeds maximum size';
const INVALID_RESPONSE_JSON = 'Invalid GIGL response JSON';

function validateMaxResponseBytes(maxResponseBytes: number): void {
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new Error(INVALID_MAX_RESPONSE_BYTES);
  }
}

function hasOversizedContentLength(
  response: Response,
  maxResponseBytes: number
): boolean {
  const contentLength = response.headers.get('content-length');
  if (!contentLength || !/^\d+$/.test(contentLength)) {
    return false;
  }

  const declaredBytes = Number(contentLength);
  return (
    !Number.isSafeInteger(declaredBytes) || declaredBytes > maxResponseBytes
  );
}

async function readBoundedResponseBytes(
  response: Response,
  maxResponseBytes: number,
  signal?: AbortSignal
): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(INVALID_RESPONSE_JSON);
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let aborted = false;

  const readChunk = () => {
    if (!signal) return reader.read();

    return new Promise<ReadableStreamReadResult<Uint8Array>>(
      (resolve, reject) => {
        const abortHandler = () => {
          aborted = true;
          const reason = signal.reason;
          if (reason instanceof Error) {
            reject(reason);
          } else {
            const error = new Error('GIGL response body aborted');
            error.name = 'AbortError';
            reject(error);
          }
          void reader.cancel().catch(() => undefined);
        };

        if (signal.aborted) {
          abortHandler();
          return;
        }

        signal.addEventListener('abort', abortHandler, { once: true });
        void reader
          .read()
          .then(resolve, reject)
          .finally(() => {
            signal.removeEventListener('abort', abortHandler);
          });
      }
    );
  };

  try {
    while (true) {
      const { done, value } = await readChunk();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxResponseBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(RESPONSE_TOO_LARGE);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof Error && error.message === RESPONSE_TOO_LARGE) {
      throw error;
    }
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError')
    ) {
      throw error;
    }
    throw new Error(INVALID_RESPONSE_JSON);
  } finally {
    if (!aborted) reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readResponseJson(
  response: Response,
  options?: GiglResponseJsonOptions
): Promise<unknown> {
  const maxResponseBytes = options?.maxResponseBytes ?? Number.MAX_SAFE_INTEGER;
  if (options?.maxResponseBytes === undefined && !options?.signal) {
    return response.json();
  }

  validateMaxResponseBytes(maxResponseBytes);
  if (hasOversizedContentLength(response, maxResponseBytes)) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(RESPONSE_TOO_LARGE);
  }

  const bytes = await readBoundedResponseBytes(
    response,
    maxResponseBytes,
    options?.signal
  );
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error(INVALID_RESPONSE_JSON);
  }
}

export async function readResponseJsonWithTimeout(
  response: Response,
  timeout: number | undefined,
  signal: AbortSignal | undefined,
  deadlineAt: number | undefined,
  options?: GiglResponseJsonOptions
): Promise<unknown> {
  const remainingTimeout = deadlineAt
    ? Math.max(deadlineAt - Date.now(), 1)
    : timeout;
  if (!remainingTimeout && !signal) {
    return readResponseJson(response, options);
  }

  const controller = new AbortController();
  const abortHandler = () => {
    controller.abort(signal?.reason ?? createAbortError());
  };
  if (signal?.aborted) {
    abortHandler();
  } else {
    signal?.addEventListener('abort', abortHandler, { once: true });
  }
  const timeoutId = remainingTimeout
    ? setTimeout(() => controller.abort(createTimeoutError()), remainingTimeout)
    : undefined;

  try {
    return await readResponseJson(response, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortHandler);
  }
}

function createAbortError(): Error {
  const error = new Error('GIGL response body aborted');
  error.name = 'AbortError';
  return error;
}

function createTimeoutError(): Error {
  const error = new Error('GIGL response body timed out');
  error.name = 'TimeoutError';
  return error;
}
