const NEXT_ASSET_ELEMENT_SELECTOR =
  'script[src*="_next/"],link[href*="_next/"]';

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

/**
 * Resolves the deployment id of the page the browser is currently running.
 * Priority: the `NEXT_DEPLOYMENT_ID` global Next registers on hydration, the
 * `data-dpl-id` attribute (present until Next's client runtime consumes it),
 * then a fingerprint of the loaded `_next` asset URLs (which carry `?dpl=`).
 */
export function getPageDeploymentId(): string {
  if (typeof document === 'undefined') {
    return 'unknown-deployment';
  }

  return (
    getNextDeploymentIdGlobal() ||
    document.documentElement.dataset.dplId ||
    getLoadedNextAssetFingerprint() ||
    'unknown-deployment'
  );
}
