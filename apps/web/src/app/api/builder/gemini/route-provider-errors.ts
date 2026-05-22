export const BUILDER_GEMINI_RETRY_CONFIG = {
  maxRetries: 1,
  initialDelayMs: 750,
  maxDelayMs: 1500,
  backoffMultiplier: 2,
};

const BUILDER_GEMINI_TIMEOUT_MS = 25_000;

export type BuilderGeminiFailure = {
  logLevel: 'error' | 'warn';
  response: {
    code: string;
    details?: string;
    error: string;
    requestId: string;
  };
  status: number;
};

export type BuilderGeminiLogContext = {
  componentCount?: number;
  merchantId?: string;
  model?: string;
  promptLength?: number;
  userId?: string;
};

export function logBuilderGeminiError(
  label: string,
  error: unknown,
  requestId: string,
  context: BuilderGeminiLogContext,
  logLevel: BuilderGeminiFailure['logLevel']
): void {
  const logPayload = {
    requestId,
    userId: context.userId,
    merchantId: context.merchantId,
    model: context.model,
    promptLength: context.promptLength,
    componentCount: context.componentCount,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };

  if (logLevel === 'warn') {
    console.warn(label, logPayload);
    return;
  }

  console.error(label, logPayload);
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}\n${error.message}\n${error.stack ?? ''}`;
  }

  return String(error);
}

export function isBuilderGeminiQuotaError(error: unknown): boolean {
  const errorText = getErrorText(error);
  return (
    /quota exceeded/i.test(errorText) || /resource_exhausted/i.test(errorText)
  );
}

export function getBuilderGeminiFailure(
  error: unknown,
  requestId: string
): BuilderGeminiFailure {
  if (isBuilderGeminiQuotaError(error)) {
    return {
      logLevel: 'warn',
      response: {
        error: 'AI editor quota is temporarily exhausted',
        code: 'ai_provider_rate_limited',
        details:
          'AI editing is rate limited right now. Please try again later.',
        requestId,
      },
      status: 429,
    };
  }

  return {
    logLevel: 'error',
    response: {
      error: 'AI editor is temporarily unavailable',
      code: 'ai_provider_unavailable',
      requestId,
    },
    status: 503,
  };
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error ||
      (typeof DOMException !== 'undefined' && error instanceof DOMException)) &&
    error.name === 'AbortError'
  );
}

export async function runBuilderGeminiWithTimeout<T>(
  operation: (abortSignal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    BUILDER_GEMINI_TIMEOUT_MS
  );

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (isAbortError(error)) {
      const timeoutError = new Error('builder_gemini_timeout');
      timeoutError.name = 'BuilderGeminiTimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
