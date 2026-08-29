import {
  type OAuthBrowserModule,
  openOAuthSession,
} from './open-oauth-session';

function browserModule(
  overrides: Partial<OAuthBrowserModule> = {}
): OAuthBrowserModule {
  return {
    getCustomTabsSupportingBrowsersAsync: jest.fn().mockResolvedValue({
      browserPackages: ['browser.preferred'],
      defaultBrowserPackage: 'browser.preferred',
      preferredBrowserPackage: 'browser.preferred',
      servicePackages: ['browser.preferred'],
    }),
    openAuthSessionAsync: jest.fn().mockResolvedValue({
      type: 'success',
      url: 'ogabassey://auth?code=oauth-code',
    }),
    ...overrides,
  };
}

function externalBrowserAdapters() {
  let onUrl: ((event: { url: string }) => void) | undefined;
  let resolveListenersReady: (() => void) | undefined;
  const listenersReady = new Promise<void>((resolve) => {
    resolveListenersReady = resolve;
  });
  const removeUrl = jest.fn();
  const removeAppState = jest.fn();
  const linking = {
    addEventListener: jest.fn(
      (_event: 'url', listener: (event: { url: string }) => void) => {
        onUrl = listener;
        resolveListenersReady?.();
        return { remove: removeUrl };
      }
    ),
    openURL: jest.fn().mockResolvedValue(undefined),
  };
  const appState = {
    addEventListener: jest.fn(() => ({ remove: removeAppState })),
  };
  return {
    appState,
    emitUrl: (url: string) => onUrl?.({ url }),
    linking,
    listenersReady,
    removeAppState,
    removeUrl,
  };
}

describe('openOAuthSession', () => {
  it('uses a PackageManager-supported browser without BrowserProxyActivity on Android', async () => {
    const webBrowser = browserModule();

    const result = await openOAuthSession({
      platform: 'android',
      redirectUrl: 'ogabassey://auth',
      url: 'https://accounts.google.com/oauth',
      webBrowser,
    });

    expect(result).toEqual({
      type: 'success',
      url: 'ogabassey://auth?code=oauth-code',
    });
    expect(webBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.google.com/oauth',
      'ogabassey://auth',
      {
        browserPackage: 'browser.preferred',
        createTask: false,
        showInRecents: false,
        useProxyActivity: false,
      }
    );
  });

  it('falls back to the system URL handler when no Custom Tabs browser is available', async () => {
    const adapters = externalBrowserAdapters();
    const webBrowser = browserModule({
      getCustomTabsSupportingBrowsersAsync: jest.fn().mockResolvedValue({
        browserPackages: [],
        defaultBrowserPackage: undefined,
        preferredBrowserPackage: undefined,
        servicePackages: [],
      }),
    });

    const resultPromise = openOAuthSession({
      appState: adapters.appState,
      linking: adapters.linking,
      platform: 'android',
      redirectUrl: 'ogabassey://auth',
      url: 'https://accounts.google.com/oauth',
      webBrowser,
    });
    await adapters.listenersReady;
    adapters.emitUrl('ogabassey://auth?code=fallback-code');

    await expect(resultPromise).resolves.toEqual({
      type: 'success',
      url: 'ogabassey://auth?code=fallback-code',
    });
    expect(webBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
    expect(adapters.linking.openURL).toHaveBeenCalledWith(
      'https://accounts.google.com/oauth'
    );
    expect(adapters.removeUrl).toHaveBeenCalled();
    expect(adapters.removeAppState).toHaveBeenCalled();
  });

  it('falls back after an Android browser launch SecurityException', async () => {
    const adapters = externalBrowserAdapters();
    const launchError = Object.assign(
      new Error('Custom Tabs SecurityException'),
      {
        name: 'SecurityException',
      }
    );
    const webBrowser = browserModule({
      openAuthSessionAsync: jest.fn().mockRejectedValue(launchError),
    });

    const resultPromise = openOAuthSession({
      appState: adapters.appState,
      linking: adapters.linking,
      platform: 'android',
      redirectUrl: 'ogabassey://auth',
      url: 'https://accounts.google.com/oauth',
      webBrowser,
    });
    await adapters.listenersReady;
    adapters.emitUrl('ogabassey://auth?code=fallback-code');

    await expect(resultPromise).resolves.toEqual({
      type: 'success',
      url: 'ogabassey://auth?code=fallback-code',
    });
    expect(adapters.linking.openURL).toHaveBeenCalled();
  });

  it('preserves the existing browser behavior on non-Android platforms', async () => {
    const webBrowser = browserModule();

    await openOAuthSession({
      platform: 'ios',
      redirectUrl: 'ogabassey://auth',
      url: 'https://accounts.google.com/oauth',
      webBrowser,
    });

    expect(
      webBrowser.getCustomTabsSupportingBrowsersAsync
    ).not.toHaveBeenCalled();
    expect(webBrowser.openAuthSessionAsync).toHaveBeenCalledWith(
      'https://accounts.google.com/oauth',
      'ogabassey://auth',
      { showInRecents: true }
    );
  });
});
