export function buildPreviewUrl(
  storeUrl: string | null | undefined,
  previewKey: number
): string {
  const trimmedStoreUrl = storeUrl?.trim();

  if (!trimmedStoreUrl) {
    return '';
  }

  const normalizedStoreUrl = trimmedStoreUrl.startsWith('http://')
    ? `https://${trimmedStoreUrl.slice('http://'.length)}`
    : /^[a-z][a-z0-9+.-]*:/i.test(trimmedStoreUrl)
      ? trimmedStoreUrl
      : `https://${trimmedStoreUrl}`;

  try {
    const previewUrl = new URL(normalizedStoreUrl);

    if (!['http:', 'https:'].includes(previewUrl.protocol)) {
      return '';
    }

    previewUrl.protocol = 'https:';
    previewUrl.searchParams.set('preview', 'true');
    previewUrl.searchParams.set('t', String(previewKey));

    return previewUrl.toString();
  } catch {
    return '';
  }
}
