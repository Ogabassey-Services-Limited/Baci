export const BUILDER_GEMINI_RETRY_CONFIG = {
  maxRetries: 1,
  initialDelayMs: 750,
  maxDelayMs: 1500,
  backoffMultiplier: 2,
};

export const BUILDER_GEMINI_TIMEOUT_MS = 25_000;

// Thrown when a provider returns JSON that doesn't match the builder config
// shape. Named so getBuilderGeminiFailure can map an exhausted chain of
// shape failures to the 502 "invalid draft" contract rather than a 503.
export const BUILDER_CONFIG_SHAPE_ERROR_NAME = 'BuilderConfigShapeError';

export function isBuilderConfigShapeError(error: unknown): boolean {
  return (
    error instanceof Error && error.name === BUILDER_CONFIG_SHAPE_ERROR_NAME
  );
}

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
  // The AI SDK's APICallError carries the upstream HTTP status — a 429 is a
  // quota/rate-limit signal regardless of the provider's error prose.
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    (error as { statusCode?: unknown }).statusCode === 429
  ) {
    return true;
  }

  const errorText = getErrorText(error);
  return (
    // Google vocabulary (Gemini free-tier exhaustion).
    /quota exceeded/i.test(errorText) ||
    /resource_exhausted/i.test(errorText) ||
    // OpenAI-compatible vocabulary (Cerebras/Groq/OpenRouter in the copilot
    // provider chain): "Rate limit reached...", "rate_limit_exceeded",
    // "temporarily rate-limited upstream".
    /rate.?limit/i.test(errorText)
  );
}

export function getBuilderGeminiFailure(
  error: unknown,
  requestId: string
): BuilderGeminiFailure {
  // Every provider returned JSON that failed the builder schema — the AI
  // couldn't produce a usable draft (distinct from a transient outage).
  if (isBuilderConfigShapeError(error)) {
    return {
      logLevel: 'error',
      response: {
        error: 'AI editor returned an invalid draft',
        code: 'ai_builder_invalid_output',
        requestId,
      },
      status: 502,
    };
  }

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
