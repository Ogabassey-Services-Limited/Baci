import { NetworkError } from '@/lib/api-client';

interface AiCopilotErrorData {
  code?: string;
  requestId?: string;
  error?: string;
  details?: string;
}

export interface FormattedAiCopilotError {
  message: string;
  code: string;
  requestId: string | null;
}

function getErrorData(error: unknown): AiCopilotErrorData {
  if (!(error instanceof NetworkError)) return {};
  const data = error.data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {};
  }

  const candidate = data as Record<string, unknown>;
  return {
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    requestId:
      typeof candidate.requestId === 'string' ? candidate.requestId : undefined,
    error: typeof candidate.error === 'string' ? candidate.error : undefined,
    details:
      typeof candidate.details === 'string' ? candidate.details : undefined,
  };
}

export function formatAiCopilotError(error: unknown): FormattedAiCopilotError {
  const data = getErrorData(error);
  const code =
    data.code ??
    (error instanceof NetworkError && error.isTimeout
      ? 'ai_provider_unavailable'
      : 'unknown');
  const requestId = typeof data.requestId === 'string' ? data.requestId : null;

  if (code === 'rate_limited') {
    return {
      code,
      requestId,
      message:
        'AI editor is cooling down. Please wait a moment before trying again.',
    };
  }

  if (code === 'ai_builder_invalid_output') {
    return {
      code,
      requestId,
      message:
        'AI returned a draft we could not safely use. Your current store is safe, and you can continue onboarding while your AI design is prepared.',
    };
  }

  if (
    code === 'ai_provider_unavailable' ||
    (error instanceof NetworkError && (error.isTimeout || error.isOffline))
  ) {
    return {
      code: 'ai_provider_unavailable',
      requestId,
      message:
        'AI editor is temporarily unavailable. Your current draft is saved; please try again later.',
    };
  }

  return {
    code,
    requestId,
    message:
      error instanceof Error
        ? error.message
        : 'AI editor could not complete the request. Your current draft was kept.',
  };
}
