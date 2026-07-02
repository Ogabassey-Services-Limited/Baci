const RELOAD_STORAGE_KEY_PREFIX = 'baci:chunk-load-recovery';
const RELOAD_COUNT_STORAGE_KEY = `${RELOAD_STORAGE_KEY_PREFIX}:reload-count`;
const WINDOW_NAME_MARKER_PATTERN = /#baci-clr\[([^\]]*)\]#/;
const MAX_RELOADS_PER_SESSION = 3;
const MAX_WINDOW_NAME_KEYS = 6;

export type RecoveryGuardDecision =
  | 'reload'
  | 'skipped-already-attempted'
  | 'skipped-session-cap'
  | 'skipped-storage-unavailable';

export interface RecoveryGuardStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface RecoveryGuardRuntime {
  getSessionStorage: () => RecoveryGuardStorage | undefined;
  getHost?: () => string;
  getWindowName?: () => string;
  setWindowName?: (value: string) => void;
}

// The host segment matters for the window.name fallback: unlike per-origin
// sessionStorage, window.name survives cross-origin navigation in the same
// tab, and every merchant storefront shares one platform deployment id — an
// unscoped key would mark merchant B's path as already-attempted after a
// recovery on merchant A.
export function getRecoveryStorageKey(
  deploymentId: string,
  pathname: string,
  host = ''
): string {
  return [RELOAD_STORAGE_KEY_PREFIX, deploymentId, host, pathname].join(':');
}

function parseWindowNameKeys(windowName: string): string[] {
  const marker = windowName.match(WINDOW_NAME_MARKER_PATTERN);
  return marker?.[1] ? marker[1].split('|').filter(Boolean) : [];
}

function serializeWindowNameKeys(windowName: string, keys: string[]): string {
  const marker = `#baci-clr[${keys.slice(-MAX_WINDOW_NAME_KEYS).join('|')}]#`;
  const withoutMarker = windowName.replace(WINDOW_NAME_MARKER_PATTERN, '');
  return `${withoutMarker}${marker}`;
}

function evaluateWithSessionStorage(
  storage: RecoveryGuardStorage,
  storageKey: string,
  commit: boolean
): RecoveryGuardDecision {
  if (storage.getItem(storageKey) === '1') {
    return 'skipped-already-attempted';
  }

  const reloadCount = Number.parseInt(
    storage.getItem(RELOAD_COUNT_STORAGE_KEY) ?? '0',
    10
  );
  if (Number.isFinite(reloadCount) && reloadCount >= MAX_RELOADS_PER_SESSION) {
    return 'skipped-session-cap';
  }

  if (commit) {
    storage.setItem(storageKey, '1');
    storage.setItem(
      RELOAD_COUNT_STORAGE_KEY,
      String((Number.isFinite(reloadCount) ? reloadCount : 0) + 1)
    );
  }

  return 'reload';
}

function evaluateWithWindowName(
  runtime: RecoveryGuardRuntime,
  storageKey: string,
  commit: boolean
): RecoveryGuardDecision {
  if (!runtime.getWindowName || !runtime.setWindowName) {
    return 'skipped-storage-unavailable';
  }

  const windowName = runtime.getWindowName();
  const attemptedKeys = parseWindowNameKeys(windowName);

  if (attemptedKeys.includes(storageKey)) {
    return 'skipped-already-attempted';
  }

  if (attemptedKeys.length >= MAX_RELOADS_PER_SESSION) {
    return 'skipped-session-cap';
  }

  if (commit) {
    runtime.setWindowName(
      serializeWindowNameKeys(windowName, [...attemptedKeys, storageKey])
    );
  }

  return 'reload';
}

/**
 * Decides whether a recovery reload may run for the given deployment/path
 * key, at most once per key and capped per session. sessionStorage is the
 * primary guard; when it is unavailable (private browsing, embedded webviews)
 * the marker survives reloads inside `window.name` instead, so recovery
 * fails open for those users without ever allowing a reload loop —
 * mainstream browsers preserve `window.name` across same-origin reloads and
 * reset it only on cross-origin navigation (Firefox 88+, Safari ITP). With
 * `commit` false this only peeks, letting error boundaries decide what to
 * render before the reload is committed in an effect.
 */
export function evaluateRecoveryGuard(
  runtime: RecoveryGuardRuntime,
  deploymentId: string,
  pathname: string,
  commit: boolean
): RecoveryGuardDecision {
  let host = '';
  try {
    host = runtime.getHost?.() ?? '';
  } catch {
    // Key scoping falls back to deployment/path only.
  }
  const storageKey = getRecoveryStorageKey(deploymentId, pathname, host);

  try {
    const storage = runtime.getSessionStorage();
    if (storage) {
      // Safari private-mode storage can throw on setItem; the catch below
      // falls through to the window.name guard so recovery still runs once.
      return evaluateWithSessionStorage(storage, storageKey, commit);
    }
  } catch {
    // Fall through to the window.name guard below.
  }

  try {
    return evaluateWithWindowName(runtime, storageKey, commit);
  } catch {
    return 'skipped-storage-unavailable';
  }
}
