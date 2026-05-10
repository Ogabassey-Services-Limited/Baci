import { describe, expect, it, vi } from 'vitest';
import { NetworkError } from '@/lib/api-client';
import { formatAiCopilotError } from './format-ai-copilot-error';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: 'localhost:8081' } },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

describe('formatAiCopilotError', () => {
  it('formats provider outages as safe onboarding fallback copy', () => {
    const error = new NetworkError('AI editor is temporarily unavailable', {
      statusCode: 503,
      data: {
        code: 'ai_provider_unavailable',
        requestId: 'req-123',
      },
    });

    expect(formatAiCopilotError(error)).toEqual({
      code: 'ai_provider_unavailable',
      requestId: 'req-123',
      message:
        'AI editor is temporarily unavailable. Your current draft is saved; please try again later.',
    });
  });

  it('formats invalid AI output without telling the merchant to retry blindly', () => {
    const error = new NetworkError('AI editor returned an invalid draft', {
      statusCode: 502,
      data: {
        code: 'ai_builder_invalid_output',
      },
    });

    expect(formatAiCopilotError(error).message).toContain(
      'Your current store is safe'
    );
  });

  it('formats rate limits as a wait message', () => {
    const error = new NetworkError('Rate limit exceeded', {
      statusCode: 429,
      data: {
        code: 'rate_limited',
      },
    });

    expect(formatAiCopilotError(error)).toEqual({
      code: 'rate_limited',
      requestId: null,
      message:
        'AI editor is cooling down. Please wait a moment before trying again.',
    });
  });

  it('preserves unknown provider codes and request ids safely', () => {
    const error = new NetworkError('Unexpected AI response', {
      statusCode: 500,
      data: {
        code: 'new_provider_error',
        requestId: 'req-unknown',
      },
    });

    expect(formatAiCopilotError(error)).toEqual({
      code: 'new_provider_error',
      requestId: 'req-unknown',
      message: 'Unexpected AI response',
    });
  });

  it('handles NetworkError values without structured data', () => {
    const error = new NetworkError('Gateway failed', {
      statusCode: 502,
    });

    expect(formatAiCopilotError(error)).toEqual({
      code: 'unknown',
      requestId: null,
      message: 'Gateway failed',
    });
  });

  it('handles malformed NetworkError data without throwing', () => {
    const error = new NetworkError('Malformed response', {
      statusCode: 500,
      data: 'not-json',
    });

    expect(formatAiCopilotError(error)).toEqual({
      code: 'unknown',
      requestId: null,
      message: 'Malformed response',
    });
  });

  it('handles NetworkError values missing statusCode', () => {
    const error = new NetworkError('Missing status', {
      data: {
        code: 'ai_provider_unavailable',
      },
    });

    expect(formatAiCopilotError(error)).toEqual(
      expect.objectContaining({
        code: 'ai_provider_unavailable',
        requestId: null,
      })
    );
  });

  it('handles plain Error values', () => {
    expect(formatAiCopilotError(new Error('Plain failure'))).toEqual({
      code: 'unknown',
      requestId: null,
      message: 'Plain failure',
    });
  });
});
