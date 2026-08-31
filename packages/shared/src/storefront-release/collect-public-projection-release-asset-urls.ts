const RELEASE_ASSET_URL_PATTERN =
  /\/release-assets\/[a-f0-9]{64}\.(?:avif|gif|jpe?g|png|svg|webp)(?![a-z0-9._-])/gu;

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/** Collects content-addressed asset paths embedded in bounded public content. */
export function collectPublicProjectionReleaseAssetUrls(
  value: unknown
): ReadonlySet<string> {
  const urls = new Set<string>();
  const pending: unknown[] = [value];
  const visited = new WeakSet<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current === 'string') {
      for (const match of current.matchAll(RELEASE_ASSET_URL_PATTERN)) {
        const url = match[0];
        if (url) urls.add(url);
      }
      continue;
    }
    if (!isObject(current) || visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    pending.push(...Object.values(current));
  }
  return urls;
}
