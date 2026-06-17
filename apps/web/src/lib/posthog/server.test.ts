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
    process.env.POSTHOG_HOST = 'https://eu.i.posthog.com';
    const { captureServerException } = await import('./server');
    const error = new Error('boom');

    await expect(
      captureServerException(error, {
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
      error,
      'baci-web-server',
      expect.objectContaining({
        app_surface: 'web',
        runtime: 'nodejs',
        route_path: '/checkout',
        email: '[Filtered]',
      })
    );
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
