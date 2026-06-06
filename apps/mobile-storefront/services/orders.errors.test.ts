import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiError, RetryExhaustedError } from '@/lib/api';

const mockLoggerWarn = jest.fn();

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: mockLoggerWarn,
  }),
}));

jest.mock('@/services/analytics', () => ({
  trackError: jest.fn(),
}));

function getMapCreateOrderException() {
  const { mapCreateOrderException } =
    require('./orders.errors') as typeof import('./orders.errors');
  return mapCreateOrderException;
}

describe('orders.errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redacts raw API error bodies from retry diagnostics', () => {
    const apiError = new ApiError(
      {
        status: 503,
        statusText: 'Service Unavailable',
      } as Response,
      {
        error: 'Provider failed',
        customer_email: 'buyer@example.com',
        customer_phone: '+2348012345678',
      }
    );
    const retryError = new RetryExhaustedError(3, apiError);

    getMapCreateOrderException()(retryError, Date.now());

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Create order request failed before retry completion',
      expect.objectContaining({
        lastError: expect.objectContaining({
          body: '[REDACTED]',
          status: 503,
          statusText: 'Service Unavailable',
        }),
      })
    );
    expect(mockLoggerWarn).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        lastError: expect.objectContaining({
          body: expect.objectContaining({
            customer_phone: expect.any(String),
          }),
        }),
      })
    );
  });

  it('does not include sensitive raw API error fields in retry diagnostics', () => {
    const apiError = new ApiError(
      {
        status: 502,
        statusText: 'Bad Gateway',
      } as Response,
      {
        error: 'Gateway failed',
        customer_email: 'buyer@example.com',
        customer_phone: '+2348012345678',
      }
    );
    const retryError = new RetryExhaustedError(2, apiError);

    getMapCreateOrderException()(retryError, Date.now());

    const diagnostics = mockLoggerWarn.mock.calls[0]?.[1] as {
      lastError?: { body?: unknown };
    };

    expect(diagnostics.lastError?.body).toBe('[REDACTED]');
    expect(JSON.stringify(diagnostics)).not.toContain('buyer@example.com');
    expect(JSON.stringify(diagnostics)).not.toContain('+2348012345678');
  });
});
