const CHUNK_LOAD_ERROR_PATTERN =
  /(?:ChunkLoadError|Loading chunk \S+ failed|Failed to load chunk|\/_next\/static\/chunks\/)/i;
const RELOAD_STORAGE_KEY_PREFIX = 'baci:chunk-load-recovery';

let chunkLoadRecoveryInitialized = false;

interface ChunkLoadRecoveryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface ChunkLoadRecoveryRuntime {
  getDeploymentId: () => string;
  getPathname: () => string;
  getSessionStorage: () => ChunkLoadRecoveryStorage | undefined;
  reload: () => void;
}

function getOwnStringProperty(
  value: object,
  key: 'message' | 'name' | 'stack'
): string | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return typeof descriptor?.value === 'string' ? descriptor.value : undefined;
}

function getErrorMessage(value: unknown): string {
  if (value instanceof Error) {
    return `${value.name} ${value.message}`;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    return [
      getOwnStringProperty(value, 'name'),
      getOwnStringProperty(value, 'message'),
      getOwnStringProperty(value, 'stack'),
    ]
      .filter((entry): entry is string => typeof entry === 'string')
      .join(' ');
  }

  return '';
}

function isChunkLoadError(value: unknown): boolean {
  return CHUNK_LOAD_ERROR_PATTERN.test(getErrorMessage(value));
}

function getCurrentDeploymentId(): string {
  return document.documentElement.dataset.dplId || 'unknown-deployment';
}

function getRecoveryStorageKey(runtime: ChunkLoadRecoveryRuntime): string {
  return [
    RELOAD_STORAGE_KEY_PREFIX,
    runtime.getDeploymentId(),
    runtime.getPathname(),
  ].join(':');
}

function shouldReloadForChunkError(runtime: ChunkLoadRecoveryRuntime): boolean {
  try {
    const storageKey = getRecoveryStorageKey(runtime);
    const storage = runtime.getSessionStorage();
    if (!storage || storage.getItem(storageKey) === '1') {
      return false;
    }

    storage.setItem(storageKey, '1');
    return true;
  } catch {
    return false;
  }
}

function reloadForChunkError(runtime: ChunkLoadRecoveryRuntime): void {
  if (!shouldReloadForChunkError(runtime)) {
    return;
  }

  runtime.reload();
}

export function createChunkLoadRecoveryHandlers(
  runtime: ChunkLoadRecoveryRuntime
) {
  return {
    handleWindowError(event: Pick<ErrorEvent, 'error' | 'message'>): void {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        reloadForChunkError(runtime);
      }
    },

    handleUnhandledRejection(
      event: Pick<PromiseRejectionEvent, 'reason'>
    ): void {
      if (isChunkLoadError(event.reason)) {
        reloadForChunkError(runtime);
      }
    },
  };
}

export function initializeChunkLoadRecovery(): void {
  if (typeof window === 'undefined' || chunkLoadRecoveryInitialized) {
    return;
  }

  chunkLoadRecoveryInitialized = true;
  const handlers = createChunkLoadRecoveryHandlers({
    getDeploymentId: getCurrentDeploymentId,
    getPathname: () => window.location.pathname,
    getSessionStorage: () => window.sessionStorage,
    reload: () => window.location.reload(),
  });

  window.addEventListener('error', handlers.handleWindowError);
  window.addEventListener(
    'unhandledrejection',
    handlers.handleUnhandledRejection
  );
}
