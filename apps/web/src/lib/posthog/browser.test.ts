import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildPostHogClientConfig: vi.fn(() => ({
    api_host: '/baci-relay',
  })),
  posthogInit: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    init: mocks.posthogInit,
  },
}));

vi.mock('@/lib/posthog/client-config', () => ({
  buildPostHogClientConfig: mocks.buildPostHogClientConfig,
}));

function importBrowserInitializer() {
  return import('./browser');
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe('initializePostHogBrowser', () => {
  it('initializes PostHog once when a public project token is configured', async () => {
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: ' ph_project_token ',
    };
    const { initializePostHogBrowser } = await importBrowserInitializer();

    initializePostHogBrowser(env);
    initializePostHogBrowser(env);

    expect(mocks.buildPostHogClientConfig).toHaveBeenCalledOnce();
    expect(mocks.buildPostHogClientConfig).toHaveBeenCalledWith(env);
    expect(mocks.posthogInit).toHaveBeenCalledOnce();
    expect(mocks.posthogInit).toHaveBeenCalledWith('ph_project_token', {
      api_host: '/baci-relay',
    });
  });

  it('warns in development when PostHog is not configured', async () => {
    const warn = vi.fn();
    const { initializePostHogBrowser } = await importBrowserInitializer();

    initializePostHogBrowser(
      {
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: '',
        NODE_ENV: 'development',
      },
      { warn }
    );

    expect(mocks.posthogInit).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing; web analytics and error capture are disabled.'
    );
  });

  it('stays quiet outside development when PostHog is not configured', async () => {
    const warn = vi.fn();
    const { initializePostHogBrowser } = await importBrowserInitializer();

    initializePostHogBrowser(
      {
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: '',
        NODE_ENV: 'production',
      },
      { warn }
    );

    expect(mocks.posthogInit).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
