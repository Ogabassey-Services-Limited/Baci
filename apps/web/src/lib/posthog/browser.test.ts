import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const clientConfigLoaded = vi.fn();

  return {
    buildPostHogClientConfig: vi.fn(() => ({
      api_host: '/baci-relay',
      loaded: clientConfigLoaded,
    })),
    clientConfigLoaded,
    posthogCapture: vi.fn(),
    posthogInit: vi.fn(),
  };
});

interface PostHogInitConfigWithLoaded {
  loaded: (posthogInstance: unknown) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPostHogLoadedCallback(
  value: unknown
): value is PostHogInitConfigWithLoaded {
  return isRecord(value) && typeof value.loaded === 'function';
}

vi.mock('posthog-js', () => ({
  default: {
    capture: mocks.posthogCapture,
    init: mocks.posthogInit,
  },
}));

vi.mock('@/lib/posthog/client-config', () => ({
  buildPostHogClientConfig: mocks.buildPostHogClientConfig,
}));

function importBrowserInitializer() {
  return import('./browser');
}

function loadPostHogClient() {
  const initConfig = mocks.posthogInit.mock.calls[0]?.[1];

  expect(hasPostHogLoadedCallback(initConfig)).toBe(true);

  if (!hasPostHogLoadedCallback(initConfig)) {
    throw new Error('PostHog init config did not include a loaded callback.');
  }

  initConfig.loaded({});
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
    expect(mocks.posthogInit).toHaveBeenCalledWith(
      'ph_project_token',
      expect.objectContaining({
        api_host: '/baci-relay',
        loaded: expect.any(Function),
      })
    );
  });

  it('queues pageviews until PostHog finishes loading', async () => {
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_project_token',
    };
    const { capturePostHogPageview, initializePostHogBrowser } =
      await importBrowserInitializer();

    capturePostHogPageview('https://usebaci.com/before-init');
    initializePostHogBrowser(env);
    capturePostHogPageview('https://usebaci.com/pricing?plan=starter');
    capturePostHogPageview('https://usebaci.com/dashboard');
    capturePostHogPageview('https://usebaci.com/dashboard');
    capturePostHogPageview('https://usebaci.com/pricing?plan=starter');

    expect(mocks.posthogCapture).not.toHaveBeenCalled();

    loadPostHogClient();

    expect(mocks.clientConfigLoaded).toHaveBeenCalledOnce();
    expect(mocks.posthogCapture).toHaveBeenCalledTimes(4);
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(1, '$pageview', {
      $current_url: 'https://usebaci.com/before-init',
      app_surface: 'web',
    });
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(2, '$pageview', {
      $current_url: 'https://usebaci.com/pricing?plan=starter',
      app_surface: 'web',
    });
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(3, '$pageview', {
      $current_url: 'https://usebaci.com/dashboard',
      app_surface: 'web',
    });
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(4, '$pageview', {
      $current_url: 'https://usebaci.com/pricing?plan=starter',
      app_surface: 'web',
    });
  });

  it('keeps queued pageviews when PostHog init throws so a retry can flush them', async () => {
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_project_token',
    };
    const initFailure = new Error('temporary init failure');
    mocks.posthogInit.mockImplementationOnce(() => {
      throw initFailure;
    });
    const { capturePostHogPageview, initializePostHogBrowser } =
      await importBrowserInitializer();

    capturePostHogPageview('https://usebaci.com/retry-me');
    expect(() => initializePostHogBrowser(env)).toThrow(initFailure);

    initializePostHogBrowser(env);
    loadPostHogClient();

    expect(mocks.posthogCapture).toHaveBeenCalledOnce();
    expect(mocks.posthogCapture).toHaveBeenCalledWith('$pageview', {
      $current_url: 'https://usebaci.com/retry-me',
      app_surface: 'web',
    });
  });

  it('clears queued pageviews and disables future queueing when tracking is unconfigured', async () => {
    const warn = vi.fn();
    const { capturePostHogPageview, initializePostHogBrowser } =
      await importBrowserInitializer();

    capturePostHogPageview('https://usebaci.com/queued-before-disabled');
    initializePostHogBrowser(
      {
        NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: '',
        NODE_ENV: 'development',
      },
      { warn }
    );
    capturePostHogPageview('https://usebaci.com/after-disabled');
    initializePostHogBrowser({ NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_token' });
    loadPostHogClient();

    expect(warn).toHaveBeenCalledWith(
      '[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing; web analytics and error capture are disabled.'
    );
    expect(mocks.posthogCapture).not.toHaveBeenCalled();
  });

  it('swallows client loaded callback errors and still flushes queued pageviews', async () => {
    const warn = vi.fn();
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_project_token',
      NODE_ENV: 'development',
    };
    const loadedFailure = new Error('loaded failed');
    mocks.clientConfigLoaded.mockImplementationOnce(() => {
      throw loadedFailure;
    });
    const { capturePostHogPageview, initializePostHogBrowser } =
      await importBrowserInitializer();

    initializePostHogBrowser(env, { warn });
    capturePostHogPageview('https://usebaci.com/dashboard');

    loadPostHogClient();

    expect(warn).toHaveBeenCalledWith(
      '[PostHog] client loaded callback failed.',
      loadedFailure
    );
    expect(mocks.posthogCapture).toHaveBeenCalledOnce();
    expect(mocks.posthogCapture).toHaveBeenCalledWith('$pageview', {
      $current_url: 'https://usebaci.com/dashboard',
      app_surface: 'web',
    });
  });

  it('dedupes only consecutive pageview captures for the same URL', async () => {
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_project_token',
    };
    const { capturePostHogPageview, initializePostHogBrowser } =
      await importBrowserInitializer();

    initializePostHogBrowser(env);
    capturePostHogPageview('https://usebaci.com/pricing');
    loadPostHogClient();
    capturePostHogPageview('https://usebaci.com/pricing');
    capturePostHogPageview('https://usebaci.com/login');
    capturePostHogPageview('https://usebaci.com/pricing');

    expect(mocks.posthogCapture).toHaveBeenCalledTimes(3);
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(1, '$pageview', {
      $current_url: 'https://usebaci.com/pricing',
      app_surface: 'web',
    });
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(2, '$pageview', {
      $current_url: 'https://usebaci.com/login',
      app_surface: 'web',
    });
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(3, '$pageview', {
      $current_url: 'https://usebaci.com/pricing',
      app_surface: 'web',
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
