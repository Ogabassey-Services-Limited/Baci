import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const postHogMocks = vi.hoisted(() => ({
  captureExceptionImmediate: vi.fn(),
  captureImmediate: vi.fn(),
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
      captureImmediate: postHogMocks.captureImmediate,
    };
  }),
}));

const REDACTED_VALUE = '[Filtered]';

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe('PostHog server exceptions', () => {
  const originalProjectToken = process.env.POSTHOG_PROJECT_TOKEN;
  const originalPublicToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const originalHost = process.env.POSTHOG_HOST;
  const originalReleaseVersion = process.env.POSTHOG_RELEASE_VERSION;
  const originalVercelCommitSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const originalVercelCommitRef = process.env.VERCEL_GIT_COMMIT_REF;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalVercelUrl = process.env.VERCEL_URL;

  beforeEach(() => {
    vi.resetModules();
    postHogMocks.captureExceptionImmediate.mockReset();
    postHogMocks.captureImmediate.mockReset();
    postHogMocks.postHogConstructor.mockReset();
    delete process.env.POSTHOG_PROJECT_TOKEN;
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    delete process.env.POSTHOG_HOST;
    delete process.env.POSTHOG_RELEASE_VERSION;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_REF;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    restoreEnv('POSTHOG_PROJECT_TOKEN', originalProjectToken);
    restoreEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', originalPublicToken);
    restoreEnv('POSTHOG_HOST', originalHost);
    restoreEnv('POSTHOG_RELEASE_VERSION', originalReleaseVersion);
    restoreEnv('VERCEL_GIT_COMMIT_SHA', originalVercelCommitSha);
    restoreEnv('VERCEL_GIT_COMMIT_REF', originalVercelCommitRef);
    restoreEnv('VERCEL_ENV', originalVercelEnv);
    restoreEnv('VERCEL_URL', originalVercelUrl);
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
    process.env.POSTHOG_RELEASE_VERSION = 'release-1';
    process.env.VERCEL_GIT_COMMIT_SHA = 'vercel-sha';
    process.env.VERCEL_GIT_COMMIT_REF = 'main';
    process.env.VERCEL_ENV = 'production';
    process.env.VERCEL_URL = 'https://baci-git-main.vercel.app/';
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
        deployment_environment: 'production',
        release_version: 'release-1',
        git_commit_sha: 'vercel-sha',
        git_commit_ref: 'main',
        vercel_environment: 'production',
        vercel_url: 'baci-git-main.vercel.app',
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

  it('normalizes blank Next.js request errors with digest and route context', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    const { captureServerException } = await import('./server');
    const error = Object.assign(new Error(''), {
      digest: 'NEXT_DIGEST_123',
      stack: 'Error: at render',
    });
    error.name = 'NextRenderError';

    await expect(
      captureServerException(error, {
        next_error_digest: 'NEXT_DIGEST_123',
        request_path: '/blog',
        route_path: '/(storefront)/[slug]/(blog)/blog/page',
      })
    ).resolves.toBe(true);

    const capturedError = postHogMocks.captureExceptionImmediate.mock
      .calls[0]?.[0] as (Error & { cause?: Error }) | undefined;
    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError).not.toBe(error);
    expect(capturedError?.name).toBe('NextRenderError');
    expect(capturedError?.stack).toBe('Error: at render');
    expect(capturedError?.cause).toBeInstanceOf(Error);
    expect(capturedError?.cause?.name).toBe('NextRenderError');
    expect(capturedError?.cause?.stack).toBe('Error: at render');
    expect(capturedError?.message).toContain('NEXT_DIGEST_123');
    expect(capturedError?.message).toContain('/blog');
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenCalledWith(
      capturedError,
      'baci-web-server',
      expect.objectContaining({
        next_error_digest: 'NEXT_DIGEST_123',
        request_path: '/blog',
      })
    );
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenCalledTimes(1);
  });

  it('uses route_path when request_path is unavailable for blank Next.js errors', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    const { captureServerException } = await import('./server');
    const error = Object.assign(new Error(''), {
      digest: 'NEXT_DIGEST_ROUTE',
    });

    await expect(
      captureServerException(error, {
        next_error_digest: 'NEXT_DIGEST_ROUTE',
        route_path: '/(storefront)/[slug]/products/page',
      })
    ).resolves.toBe(true);

    const capturedError = postHogMocks.captureExceptionImmediate.mock
      .calls[0]?.[0] as Error | undefined;
    expect(capturedError?.message).toContain('NEXT_DIGEST_ROUTE');
    expect(capturedError?.message).toContain(
      '/(storefront)/[slug]/products/page'
    );
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenCalledTimes(1);
  });

  it('uses an error digest when properties do not provide one', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    const { captureServerException } = await import('./server');
    const error = Object.assign(new Error(''), {
      digest: 'NEXT_DIGEST_FROM_ERROR',
    });

    await expect(
      captureServerException(error, {
        request_path: '/products',
      })
    ).resolves.toBe(true);

    const capturedError = postHogMocks.captureExceptionImmediate.mock
      .calls[0]?.[0] as Error | undefined;
    expect(capturedError?.message).toContain('NEXT_DIGEST_FROM_ERROR');
    expect(capturedError?.message).toContain('/products');
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenCalledTimes(1);
  });

  it('does not normalize non-Error exception payloads', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    const { captureServerException } = await import('./server');
    const errorPayload = {
      digest: 'NEXT_DIGEST_OBJECT',
      message: '',
      route: '/blog',
    };

    await expect(
      captureServerException(errorPayload, {
        next_error_digest: 'NEXT_DIGEST_OBJECT',
        request_path: '/blog',
      })
    ).resolves.toBe(true);

    const capturedPayload =
      postHogMocks.captureExceptionImmediate.mock.calls[0]?.[0];
    expect(capturedPayload).toEqual(errorPayload);
    expect(capturedPayload).not.toBeInstanceOf(Error);
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenCalledTimes(1);
  });

  it('does not normalize Error instances that already have a message', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    const { captureServerException } = await import('./server');
    const error = new Error('database failed');

    await expect(
      captureServerException(error, {
        next_error_digest: 'NEXT_DIGEST_IGNORED',
        request_path: '/blog',
      })
    ).resolves.toBe(true);

    const capturedError = postHogMocks.captureExceptionImmediate.mock
      .calls[0]?.[0] as Error | undefined;
    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError?.message).toBe('database failed');
    expect(capturedError?.message).not.toContain('Next.js request error');
    expect(capturedError?.message).not.toContain('NEXT_DIGEST_IGNORED');
    expect(postHogMocks.captureExceptionImmediate).toHaveBeenCalledTimes(1);
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

describe('captureServerEvent', () => {
  const originalProjectToken = process.env.POSTHOG_PROJECT_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    postHogMocks.captureImmediate.mockReset();
    postHogMocks.postHogConstructor.mockReset();
    delete process.env.POSTHOG_PROJECT_TOKEN;
  });

  afterEach(() => {
    restoreEnv('POSTHOG_PROJECT_TOKEN', originalProjectToken);
  });

  it('does not capture when the server client is unconfigured', async () => {
    const { captureServerEvent } = await import('./server');

    await expect(
      captureServerEvent(
        'wallet_funding_transfer_credited',
        { amount: 5000 },
        'customer-1'
      )
    ).resolves.toBe(false);
    expect(postHogMocks.postHogConstructor).not.toHaveBeenCalled();
    expect(postHogMocks.captureImmediate).not.toHaveBeenCalled();
  });

  it('captures the event with the customer distinct id and sanitized properties', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    postHogMocks.captureImmediate.mockResolvedValueOnce(undefined as never);
    const { captureServerEvent } = await import('./server');

    await expect(
      captureServerEvent(
        'wallet_funding_transfer_credited',
        {
          amount: 5000,
          currency: 'NGN',
          customer_id: 'customer-1',
          gateway: 'paystack',
          gateway_reference: 'PSK_REF_1',
          merchant_id: 'merchant-1',
        },
        'customer-1'
      )
    ).resolves.toBe(true);

    expect(postHogMocks.captureImmediate).toHaveBeenCalledWith({
      distinctId: 'customer-1',
      event: 'wallet_funding_transfer_credited',
      properties: expect.objectContaining({
        app_surface: 'web',
        runtime: 'nodejs',
        amount: 5000,
        currency: 'NGN',
        customer_id: 'customer-1',
        gateway: 'paystack',
        gateway_reference: 'PSK_REF_1',
        merchant_id: 'merchant-1',
      }),
    });
  });

  it('returns false without throwing when the immediate send rejects', async () => {
    process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
    postHogMocks.captureImmediate.mockRejectedValueOnce(
      new Error('network down') as never
    );
    const { captureServerEvent } = await import('./server');

    await expect(
      captureServerEvent(
        'wallet_funding_transfer_credited',
        { amount: 5000 },
        'customer-1'
      )
    ).resolves.toBe(false);
  });

  it('returns false when the immediate send exceeds the capture timeout', async () => {
    vi.useFakeTimers();
    try {
      process.env.POSTHOG_PROJECT_TOKEN = 'ph_test';
      postHogMocks.captureImmediate.mockReturnValueOnce(
        new Promise(() => {}) as never
      );
      const { captureServerEvent } = await import('./server');

      const result = captureServerEvent(
        'wallet_funding_transfer_credited',
        { amount: 5000 },
        'customer-1'
      );

      await vi.advanceTimersByTimeAsync(3_000);

      await expect(result).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
