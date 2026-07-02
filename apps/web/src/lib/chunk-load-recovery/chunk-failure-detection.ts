const CHUNK_LOAD_ERROR_PATTERN =
  /(?:ChunkLoadError|Loading (?:CSS )?chunk \S+ failed|Failed to load chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|\/_next\/static\/chunks\/)/i;

// Matches the first Next static asset URL embedded in an error message, e.g.
// Turbopack's "Failed to load chunk /_next/static/chunks/<file>?dpl=<id> from module <n>".
const NEXT_ASSET_URL_IN_MESSAGE_PATTERN =
  /(?:https?:\/\/[^\s'")]+)?\/_next\/static\/[^\s'")]+/i;

export interface ChunkFailureDetails {
  failedAssetUrl: string | null;
  failedAssetDeploymentId: string | null;
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

function getDeploymentIdFromAssetUrl(assetUrl: string): string | null {
  try {
    const parsed = new URL(assetUrl, 'https://placeholder.invalid');
    return parsed.searchParams.get('dpl')?.trim() || null;
  } catch {
    return null;
  }
}

function buildDetails(assetUrl: string | null): ChunkFailureDetails {
  return {
    failedAssetUrl: assetUrl,
    failedAssetDeploymentId: assetUrl
      ? getDeploymentIdFromAssetUrl(assetUrl)
      : null,
  };
}

/**
 * Detects chunk-load failures carried by thrown values: Error instances
 * (Turbopack rejects with `ChunkLoadError` named errors), rejection reasons,
 * and plain message strings forwarded by `ErrorEvent.message`.
 */
export function detectChunkFailureFromValue(
  value: unknown
): ChunkFailureDetails | null {
  const message = getErrorMessage(value);

  if (!CHUNK_LOAD_ERROR_PATTERN.test(message)) {
    return null;
  }

  const assetUrlMatch = message.match(NEXT_ASSET_URL_IN_MESSAGE_PATTERN);
  return buildDetails(assetUrlMatch ? assetUrlMatch[0] : null);
}

/**
 * Detects chunk-load failures surfaced as resource `error` events. A failing
 * `<script>`/`<link>` dispatches a plain capture-phase Event whose `error` and
 * `message` are both undefined, so the failing element itself is the only
 * signal that a Next static asset broke.
 */
export function detectChunkFailureFromResourceTarget(
  target: unknown
): ChunkFailureDetails | null {
  if (typeof HTMLScriptElement === 'undefined') {
    return null;
  }

  let assetUrl: string | undefined;

  if (target instanceof HTMLScriptElement) {
    assetUrl = target.src;
  } else if (target instanceof HTMLLinkElement && target.rel === 'stylesheet') {
    assetUrl = target.href;
  }

  if (!assetUrl?.includes('/_next/static/')) {
    return null;
  }

  return buildDetails(assetUrl);
}
