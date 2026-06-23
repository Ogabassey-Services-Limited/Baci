import { afterEach, describe, expect, it, vi } from 'vitest';

const PAGEVIEW_CAPTURE_OPTIONS = { send_instantly: true };

const mocks = vi.hoisted(() => {
  const clientConfigLoaded = vi.fn();
  const posthogCapture = vi.fn();
  const posthogInit = vi.fn();
  const posthogReloadFeatureFlags = vi.fn();
  const posthogSetConfig = vi.fn();
  const webVitalsStartIfEnabled = vi.fn();
  const buildPostHogClientConfig = vi.fn(
    (_env: unknown, _token: unknown, options?: { lightweight?: boolean }) => ({
      advanced_disable_flags: options?.lightweight === true,
      api_host: '/baci-relay',
      loaded: clientConfigLoaded,
    })
  );
  const posthogClient = {
    __loaded: false,
    capture: posthogCapture,
    init: posthogInit,
    reloadFeatureFlags: posthogReloadFeatureFlags,
    set_config: posthogSetConfig,
    webVitalsAutocapture: {
      startIfEnabled: webVitalsStartIfEnabled,
    },
  };

  return {
    buildPostHogClientConfig,
    clientConfigLoaded,
    posthogCapture,
    posthogClient,
    posthogInit,
    posthogReloadFeatureFlags,
    posthogSetConfig,
    webVitalsStartIfEnabled,
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
  default: mocks.posthogClient,
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

  initConfig.loaded(mocks.posthogClient);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  mocks.posthogClient.__loaded = false;
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
    expect(mocks.buildPostHogClientConfig).toHaveBeenLastCalledWith(
      env,
      'ph_project_token',
      { lightweight: false }
    );
    expect(mocks.posthogInit).toHaveBeenCalledOnce();
    expect(mocks.posthogInit).toHaveBeenCalledWith(
      'ph_project_token',
      expect.objectContaining({
        api_host: '/baci-relay',
        loaded: expect.any(Function),
      })
    );
    expect(mocks.posthogInit.mock.calls[0]?.[1]).not.toHaveProperty(
      'advanced_disable_flags'
    );
    expect(mocks.posthogSetConfig).not.toHaveBeenCalled();
    expect(mocks.posthogReloadFeatureFlags).not.toHaveBeenCalled();
    expect(mocks.webVitalsStartIfEnabled).not.toHaveBeenCalled();
  });

  it('requests the lightweight config on public blog surfaces without locking init-time flag config', async () => {
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_project_token',
    };
    vi.stubGlobal('location', {
      hostname: 'usebaci.com',
      pathname: '/ogabassey/blog/best-phones',
      href: 'https://usebaci.com/ogabassey/blog/best-phones',
    });
    const { initializePostHogBrowser } = await importBrowserInitializer();

    initializePostHogBrowser(env);

    expect(mocks.buildPostHogClientConfig).toHaveBeenCalledOnce();
    expect(mocks.buildPostHogClientConfig).toHaveBeenCalledWith(
      env,
      'ph_project_token',
      { lightweight: true }
    );
    expect(mocks.posthogInit).toHaveBeenCalledOnce();
    expect(mocks.posthogInit.mock.calls[0]?.[1]).not.toHaveProperty(
      'advanced_disable_flags'
    );
    expect(mocks.posthogSetConfig).not.toHaveBeenCalled();

    loadPostHogClient();

    expect(mocks.posthogSetConfig).toHaveBeenCalledOnce();
    expect(mocks.posthogSetConfig).toHaveBeenCalledWith({
      advanced_disable_flags: true,
    });
    expect(mocks.posthogSetConfig.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.clientConfigLoaded.mock.invocationCallOrder[0] ??
        Number.POSITIVE_INFINITY
    );
    expect(mocks.posthogReloadFeatureFlags).not.toHaveBeenCalled();
    expect(mocks.webVitalsStartIfEnabled).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('reconfigures an initialized client when entering public blog surfaces', async () => {
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_project_token',
    };
    vi.stubGlobal('location', {
      hostname: 'usebaci.com',
      pathname: '/pricing',
      href: 'https://usebaci.com/pricing',
    });
    const { initializePostHogBrowser } = await importBrowserInitializer();

    initializePostHogBrowser(env);

    vi.stubGlobal('location', {
      hostname: 'usebaci.com',
      pathname: '/ogabassey/blog/best-phones',
      href: 'https://usebaci.com/ogabassey/blog/best-phones',
    });
    initializePostHogBrowser(env);

    expect(mocks.buildPostHogClientConfig).toHaveBeenLastCalledWith(
      env,
      'ph_project_token',
      { lightweight: true }
    );
    expect(mocks.posthogSetConfig).toHaveBeenCalledOnce();
    expect(mocks.posthogSetConfig).toHaveBeenCalledWith({
      advanced_disable_flags: true,
      api_host: '/baci-relay',
    });
    expect(mocks.posthogReloadFeatureFlags).not.toHaveBeenCalled();
    expect(mocks.webVitalsStartIfEnabled).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('clears lightweight flag disabling when returning to full instrumentation', async () => {
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_project_token',
    };
    vi.stubGlobal('location', {
      hostname: 'usebaci.com',
      pathname: '/ogabassey/blog/best-phones',
      href: 'https://usebaci.com/ogabassey/blog/best-phones',
    });
    const { initializePostHogBrowser } = await importBrowserInitializer();

    initializePostHogBrowser(env);
    loadPostHogClient();

    vi.stubGlobal('location', {
      hostname: 'usebaci.com',
      pathname: '/ogabassey/products',
      href: 'https://usebaci.com/ogabassey/products',
    });
    initializePostHogBrowser(env);

    expect(mocks.buildPostHogClientConfig).toHaveBeenLastCalledWith(
      env,
      'ph_project_token',
      { lightweight: false }
    );
    expect(mocks.posthogSetConfig).toHaveBeenCalledTimes(2);
    expect(mocks.posthogSetConfig).toHaveBeenNthCalledWith(1, {
      advanced_disable_flags: true,
    });
    expect(mocks.posthogSetConfig).toHaveBeenNthCalledWith(2, {
      advanced_disable_flags: false,
      api_host: '/baci-relay',
    });
    expect(mocks.posthogReloadFeatureFlags).toHaveBeenCalledOnce();
    expect(mocks.webVitalsStartIfEnabled).toHaveBeenCalledOnce();
    expect(
      mocks.webVitalsStartIfEnabled.mock.invocationCallOrder[0]
    ).toBeGreaterThan(mocks.posthogSetConfig.mock.invocationCallOrder[1] ?? 0);

    vi.unstubAllGlobals();
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
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(
      1,
      '$pageview',
      {
        $current_url: 'https://usebaci.com/before-init',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(
      2,
      '$pageview',
      {
        $current_url: 'https://usebaci.com/pricing?plan=starter',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(
      3,
      '$pageview',
      {
        $current_url: 'https://usebaci.com/dashboard',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(
      4,
      '$pageview',
      {
        $current_url: 'https://usebaci.com/pricing?plan=starter',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
  });

  it('flushes queued pageviews when the PostHog client is already loaded after init', async () => {
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_project_token',
    };
    mocks.posthogInit.mockImplementationOnce(() => {
      mocks.posthogClient.__loaded = true;
    });
    const { capturePostHogPageview, initializePostHogBrowser } =
      await importBrowserInitializer();

    capturePostHogPageview('https://usebaci.com/loaded-state');
    initializePostHogBrowser(env);

    expect(mocks.clientConfigLoaded).not.toHaveBeenCalled();
    expect(mocks.posthogCapture).toHaveBeenCalledOnce();
    expect(mocks.posthogCapture).toHaveBeenCalledWith(
      '$pageview',
      {
        $current_url: 'https://usebaci.com/loaded-state',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
  });

  it('flushes a pageview queued after init when PostHog loads without firing the loaded callback', async () => {
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_project_token',
    };
    const { capturePostHogPageview, initializePostHogBrowser } =
      await importBrowserInitializer();

    initializePostHogBrowser(env);
    mocks.posthogClient.__loaded = true;
    capturePostHogPageview('https://usebaci.com/async-loaded');

    expect(mocks.clientConfigLoaded).not.toHaveBeenCalled();
    expect(mocks.posthogCapture).toHaveBeenCalledOnce();
    expect(mocks.posthogCapture).toHaveBeenCalledWith(
      '$pageview',
      {
        $current_url: 'https://usebaci.com/async-loaded',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
  });

  it('flushes a pageview queued before init when the loaded state flips without firing the loaded callback', async () => {
    // Arrange
    vi.useFakeTimers();
    const env = {
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: 'ph_project_token',
    };
    const { capturePostHogPageview, initializePostHogBrowser } =
      await importBrowserInitializer();

    capturePostHogPageview('https://usebaci.com/initial-visit');

    // Act
    initializePostHogBrowser(env);

    expect(mocks.posthogCapture).not.toHaveBeenCalled();

    mocks.posthogClient.__loaded = true;
    await vi.runOnlyPendingTimersAsync();

    // Assert
    expect(mocks.clientConfigLoaded).not.toHaveBeenCalled();
    expect(mocks.posthogCapture).toHaveBeenCalledOnce();
    expect(mocks.posthogCapture).toHaveBeenCalledWith(
      '$pageview',
      {
        $current_url: 'https://usebaci.com/initial-visit',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
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
    expect(mocks.posthogCapture).toHaveBeenCalledWith(
      '$pageview',
      {
        $current_url: 'https://usebaci.com/retry-me',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
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
    expect(mocks.posthogCapture).toHaveBeenCalledWith(
      '$pageview',
      {
        $current_url: 'https://usebaci.com/dashboard',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
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
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(
      1,
      '$pageview',
      {
        $current_url: 'https://usebaci.com/pricing',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(
      2,
      '$pageview',
      {
        $current_url: 'https://usebaci.com/login',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
    expect(mocks.posthogCapture).toHaveBeenNthCalledWith(
      3,
      '$pageview',
      {
        $current_url: 'https://usebaci.com/pricing',
        app_surface: 'web',
      },
      PAGEVIEW_CAPTURE_OPTIONS
    );
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
