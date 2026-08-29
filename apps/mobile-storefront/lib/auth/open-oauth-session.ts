import type {
  AuthSessionOpenOptions,
  WebBrowserAuthSessionResult,
  WebBrowserCustomTabsResults,
} from 'expo-web-browser';
import { WebBrowserResultType } from 'expo-web-browser';
import { AppState, Linking, Platform } from 'react-native';

type UrlEvent = { url: string };
type UrlSubscription = { remove: () => void };
type AppStateStatus = 'active' | string;

export interface OAuthBrowserModule {
  openAuthSessionAsync: (
    url: string,
    redirectUrl?: string | null,
    options?: AuthSessionOpenOptions
  ) => Promise<WebBrowserAuthSessionResult>;
  getCustomTabsSupportingBrowsersAsync?: () => Promise<WebBrowserCustomTabsResults>;
}

interface LinkingAdapter {
  addEventListener: (
    event: 'url',
    listener: (event: UrlEvent) => void
  ) => UrlSubscription;
  openURL: (url: string) => Promise<unknown>;
}

interface AppStateAdapter {
  currentState?: AppStateStatus | null;
  addEventListener: (
    event: 'change',
    listener: (state: AppStateStatus) => void
  ) => UrlSubscription;
}

function matchesRedirectUrl(callbackUrl: string, redirectUrl: string): boolean {
  try {
    const callback = new URL(callbackUrl);
    const redirect = new URL(redirectUrl);
    return (
      callback.protocol === redirect.protocol &&
      callback.hostname === redirect.hostname &&
      callback.port === redirect.port &&
      callback.pathname === redirect.pathname
    );
  } catch {
    return false;
  }
}

interface CustomTabsSelection {
  browserPackage?: string;
  hasSupportingBrowser: boolean;
}

function selectCustomTabsBrowser(
  browsers: WebBrowserCustomTabsResults
): CustomTabsSelection {
  const browserPackages = Array.isArray(browsers.browserPackages)
    ? browsers.browserPackages
    : [];
  const candidates = [
    browsers.preferredBrowserPackage,
    browsers.defaultBrowserPackage,
  ];
  const browserPackage = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && browserPackages.includes(candidate)
  );

  return {
    browserPackage,
    hasSupportingBrowser: browserPackages.length > 0,
  };
}

function isBrowserLaunchFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as { name?: unknown; message?: unknown };
  const text = `${String(record.name || '')} ${String(record.message || '')}`;
  return /activitynotfound|nomatchingactivity|securityexception|custom tabs/i.test(
    text
  );
}

function openExternalAuthSession({
  appState,
  linking,
  redirectUrl,
  url,
}: {
  appState: AppStateAdapter;
  linking: LinkingAdapter;
  redirectUrl: string;
  url: string;
}): Promise<WebBrowserAuthSessionResult> {
  return new Promise((resolve, reject) => {
    let opened = false;
    let settled = false;
    let appStateSubscription: UrlSubscription | undefined;
    let urlSubscription: UrlSubscription | undefined;
    let initialAppStateObserved =
      appState.currentState !== null && appState.currentState !== undefined;

    const cleanup = () => {
      urlSubscription?.remove();
      appStateSubscription?.remove();
    };
    const settle = (result: WebBrowserAuthSessionResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    urlSubscription = linking.addEventListener(
      'url',
      ({ url: callbackUrl }) => {
        if (matchesRedirectUrl(callbackUrl, redirectUrl)) {
          settle({ type: 'success', url: callbackUrl });
        }
      }
    );
    appStateSubscription = appState.addEventListener('change', (state) => {
      if (!initialAppStateObserved) {
        initialAppStateObserved = true;
        return;
      }
      if (opened && state === 'active') {
        settle({ type: WebBrowserResultType.CANCEL });
      }
    });

    linking.openURL(url).then(
      () => {
        opened = true;
      },
      (error) => {
        cleanup();
        reject(error);
      }
    );
  });
}

/**
 * Opens the Google OAuth flow without routing Android through Expo's
 * BrowserProxyActivity. Some Android 10 browser implementations reject the
 * proxy's cross-task Custom Tab launch with a SecurityException. We select a
 * package reported by PackageManager when available, use the direct launch
 * path, and fall back to the system URL handler when Custom Tabs cannot run.
 */
export async function openOAuthSession({
  appState = AppState,
  linking = Linking,
  platform = Platform.OS,
  redirectUrl,
  url,
  webBrowser,
}: {
  appState?: AppStateAdapter;
  linking?: LinkingAdapter;
  platform?: string;
  redirectUrl: string;
  url: string;
  webBrowser: OAuthBrowserModule;
}): Promise<WebBrowserAuthSessionResult> {
  if (platform !== 'android') {
    return webBrowser.openAuthSessionAsync(url, redirectUrl, {
      showInRecents: true,
    });
  }

  let selection: CustomTabsSelection = {
    hasSupportingBrowser: true,
  };
  if (typeof webBrowser.getCustomTabsSupportingBrowsersAsync === 'function') {
    try {
      selection = selectCustomTabsBrowser(
        await webBrowser.getCustomTabsSupportingBrowsersAsync()
      );
    } catch {
      selection = { hasSupportingBrowser: false };
    }
  }

  if (selection.hasSupportingBrowser) {
    try {
      const options: AuthSessionOpenOptions = {
        createTask: false,
        showInRecents: false,
        useProxyActivity: false,
        ...(selection.browserPackage
          ? { browserPackage: selection.browserPackage }
          : {}),
      };
      return await webBrowser.openAuthSessionAsync(url, redirectUrl, options);
    } catch (error) {
      if (!isBrowserLaunchFailure(error)) throw error;
    }
  }

  return openExternalAuthSession({
    appState,
    linking,
    redirectUrl,
    url,
  });
}
