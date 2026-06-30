const CHUNK_LOAD_ERROR_PATTERN =
  /(?:ChunkLoadError|Loading chunk \S+ failed|Failed to load chunk|\/_next\/static\/chunks\/)/i;
const NEXT_ASSET_ELEMENT_SELECTOR =
  'script[src*="_next/"],link[href*="_next/"]';
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

function getNextDeploymentIdGlobal(): string | undefined {
  const deploymentId = (globalThis as { NEXT_DEPLOYMENT_ID?: unknown })
    .NEXT_DEPLOYMENT_ID;

  return typeof deploymentId === 'string' && deploymentId.trim()
    ? deploymentId.trim()
    : undefined;
}

function hashDeploymentFingerprint(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

function getNormalizedNextAssetReference(
  value: string | null
): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const assetUrl = new URL(value, document.baseURI);

    if (!assetUrl.pathname.includes('/_next/')) {
      return undefined;
    }

    const deploymentQueryValue = assetUrl.searchParams.get('dpl')?.trim();
    if (deploymentQueryValue) {
      return `dpl:${deploymentQueryValue}`;
    }

    return `${assetUrl.pathname}${assetUrl.search}`;
  } catch {
    return undefined;
  }
}

function getLoadedNextAssetFingerprint(): string | undefined {
  const assetReferences = new Set<string>();

  for (const element of document.querySelectorAll(
    NEXT_ASSET_ELEMENT_SELECTOR
  )) {
    const assetReference = getNormalizedNextAssetReference(
      element.getAttribute('src') || element.getAttribute('href')
    );

    if (!assetReference) {
      continue;
    }

    if (assetReference.startsWith('dpl:')) {
      return assetReference;
    }

    assetReferences.add(assetReference);
  }

  if (assetReferences.size === 0) {
    return undefined;
  }

  return `assets-${hashDeploymentFingerprint(
    Array.from(assetReferences).sort().join('|')
  )}`;
}

function getCurrentDeploymentId(): string {
  return (
    getNextDeploymentIdGlobal() ||
    document.documentElement.dataset.dplId ||
    getLoadedNextAssetFingerprint() ||
    'unknown-deployment'
  );
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
  const initialDeploymentId = getCurrentDeploymentId();
  const handlers = createChunkLoadRecoveryHandlers({
    getDeploymentId: () => initialDeploymentId,
    getPathname: () => window.location.pathname,
    getSessionStorage: () => window.sessionStorage,
    reload: () => window.location.reload(),
  });

  window.addEventListener('error', handlers.handleWindowError, {
    capture: true,
  });
  window.addEventListener(
    'unhandledrejection',
    handlers.handleUnhandledRejection,
    { capture: true }
  );
}
