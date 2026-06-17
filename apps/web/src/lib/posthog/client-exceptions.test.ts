import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const postHogMocks = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    captureException: postHogMocks.captureException,
  },
}));

describe('PostHog client exceptions', () => {
  const originalToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    postHogMocks.captureException.mockReset();
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    } else {
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = originalToken;
    }
  });

  it('does not capture when the project token is missing', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const { captureClientException } = await import('./client-exceptions');

    expect(captureClientException(new Error('missing token'))).toBe(false);
    expect(postHogMocks.captureException).not.toHaveBeenCalled();
  });

  it('captures handled browser errors with sanitized route context', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = 'ph_test';
    const { captureClientException } = await import('./client-exceptions');
    const error = new Error('checkout failed');

    expect(
      captureClientException(error, {
        route: 'checkout',
        email: 'buyer@example.com',
      })
    ).toBe(true);

    expect(postHogMocks.captureException).toHaveBeenCalledWith(error, {
      app_surface: 'web',
      runtime: 'browser',
      route: 'checkout',
      email: '[Filtered]',
    });
  });
});
