export function isValidPreviewUrl(url: string): boolean {
  if (!url.trim()) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    // Preview must support merchant-owned custom domains, so enforce HTTPS
    // without narrowing the host to a fixed Baci allowlist.
    return parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}
