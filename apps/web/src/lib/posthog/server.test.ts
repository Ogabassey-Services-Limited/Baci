import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const postHogMocks = vi.hoisted(() => ({
  captureExceptionImmediate: vi.fn(),
  postHogConstructor: vi.fn(),
}));

vi.mock('posthog-node', () => ({
  PostHog: vi.fn().mockImplementation(function PostHogMock(
    token: string,
    options: unknown
  ) {
    postHogMocks.postHogConstructor(token, options);
    return {
      captureExceptionImmediate: postHogMocks.captureExceptionImmediate,
    };
  }),
}));

describe('PostHog server exceptions', () => {
  const originalProjectToken = process.env.POSTHOG_PROJECT_TOKEN;
  const originalPublicToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const originalHost = process.env.POSTHOG_HOST;

  beforeEach(() => {
    vi.resetModules();
    postHogMocks.captureExceptionImmediate.mockReset();
    postHogMocks.postHogConstructor.mockReset();
    delete process.env.POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    delete process.env.POSTHOG_HOST;
  });

  afterEach(() => {
    restoreEnv('POSTHOG_PROJECT_TOKEN', originalProjectToken);
    restoreEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', originalPublicToken);
    restoreEnv('POSTHOG_HOST', originalHost);
  });

  it('detects missing and configured server tokens', async () => {
    const { isPostHogServerConfigured } = await import('./server');

    expect(isPostHogServerConfigured({})).toBe(false);
    expect(
      isPostHogServerConfigured({
        POSTHOG_PROJECT_TOKEN: 'ph_test',
      })
    ).toBe(true);
  });

  it('does not capture server exceptions when unconfigured', async () => {
    const { captureServerException } = await import('./server');

    await expect(captureServerException(new Error('boom'))).resolves.toBe(
      false
    );
    expect(postHogMocks.postHogConstructor).not.toHaveBeenCalled();
    expect(postHogMocks.captureExceptionImmediate).not.toHaveBeenCalled();
  });

  it('captures server exceptions immediately with sanitized properties', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    process.env.POSTHOG_HOST = 'https://eu.i.posthog.com/';
    const { captureServerException } = await import('./server');
    const error = new Error('boom');

    await expect(
      captureServerException(error, {
        app_surface: 'mobile',
        runtime: 'browser',
        route_path: '/checkout',
        email: 'buyer@example.com',
      })
    ).resolves.toBe(true);

    expect(postHogMocks.postHogConstructor).toHaveBeenCalledWith('ph_test', {
      host: 'https://eu.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenCalledWith(
      expect.any(Error),
      'baci-web-server',
      expect.objectContaining({
        app_surface: 'web',
        runtime: 'nodejs',
        route_path: '/checkout',
        email: '[Filtered]',
      })
    );
    expect(postHogMocks.captureExceptionImmediate.mock.calls[0]?.[0]).not.toBe(
      error
    );
  });

  it('sanitizes exception messages, stacks, and causes before upload', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    const { captureServerException } = await import('./server');
    const error = new Error(
      'Paystack failed for buyer@example.com at https://pay.example/callback?token=raw_secret&reference=ref_1234567 phone=08012345678 body={"token":"json_secret","transaction_reference":"ref_json_123"}'
    );
    error.stack =
      'Error: token=raw_secret reference=ref_1234567 buyer@example.com phone=08012345678';
    Object.defineProperty(error, 'cause', {
      configurable: true,
      value: new Error('provider api_key=sk_test_secret phone=08012345678'),
    });

    await expect(captureServerException(error)).resolves.toBe(true);

    const capturedError = postHogMocks.captureExceptionImmediate.mock
      .calls[0]?.[0] as (Error & { cause?: Error }) | undefined;

    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError).not.toBe(error);
    expect(capturedError?.message).toContain(REDACTED_VALUE);
    expect(capturedError?.message).not.toContain('buyer@example.com');
    expect(capturedError?.message).not.toContain('raw_secret');
    expect(capturedError?.message).not.toContain('ref_1234567');
    expect(capturedError?.message).not.toContain('json_secret');
    expect(capturedError?.message).not.toContain('ref_json_123');
    expect(capturedError?.message).not.toContain('08012345678');
    expect(capturedError?.stack).not.toContain('buyer@example.com');
    expect(capturedError?.stack).not.toContain('raw_secret');
    expect(capturedError?.stack).not.toContain('ref_1234567');
    expect(capturedError?.cause?.message).not.toContain('sk_test_secret');
    expect(capturedError?.cause?.message).not.toContain('08012345678');
  });

  it('sanitizes object causes before upload', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    const { captureServerException } = await import('./server');
    const error = new Error('provider failed');
    Object.defineProperty(error, 'cause', {
      configurable: true,
      value: {
        token: 'cause_secret',
        nested: {
          authorization: 'Bearer nested_secret',
          note: 'reference=ref_1234567 buyer@example.com',
        },
      },
    });

    await expect(captureServerException(error)).resolves.toBe(true);

    const capturedError = postHogMocks.captureExceptionImmediate.mock
      .calls[0]?.[0] as
      | (Error & {
          cause?: Record<string, unknown>;
        })
      | undefined;

    expect(capturedError?.cause).toEqual({
      token: REDACTED_VALUE,
      nested: {
        authorization: REDACTED_VALUE,
        note: `reference=${REDACTED_VALUE} ${REDACTED_VALUE}`,
      },
    });
  });

  it('creates a new server client when token or host changes', async () => {
    const { getPostHogServerClient } = await import('./server');

    expect(
      getPostHogServerClient({
        POSTHOG_PROJECT_TOKEN: 'ph_one',
        POSTHOG_HOST: 'https://one.example.com',
      })
    ).not.toBeNull();
    expect(
      getPostHogServerClient({
        POSTHOG_PROJECT_TOKEN: 'ph_two',
        POSTHOG_HOST: 'https://two.example.com/',
      })
    ).not.toBeNull();

    expect(postHogMocks.postHogConstructor).toHaveBeenNthCalledWith(
      1,
      'ph_one',
      {
        host: 'https://one.example.com',
        flushAt: 1,
        flushInterval: 0,
      }
    );
    expect(postHogMocks.postHogConstructor).toHaveBeenNthCalledWith(
      2,
      'ph_two',
      {
        host: 'https://two.example.com',
        flushAt: 1,
        flushInterval: 0,
      }
    );
  });

  it('returns false when the PostHog send fails', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    postHogMocks.captureExceptionImmediate.mockRejectedValueOnce(
      new Error('network down') as never
    );
    const { captureServerException } = await import('./server');

    await expect(captureServerException(new Error('boom'))).resolves.toBe(
      false
    );
  });
});

const REDACTED_VALUE = '[Filtered]';

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
