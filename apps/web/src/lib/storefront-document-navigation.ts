/**
 * Only full-document GET/HEAD navigations can receive a synthetic HTML status.
 * Router data and prefetch requests must keep flowing to Next's normal route
 * handling, which produces the response shape its client router expects.
 */
export function isStorefrontDocumentNavigation(
  method: string,
  headers: Headers
): boolean {
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }

  if (
    headers.get('rsc') === '1' ||
    headers.has('next-router-prefetch') ||
    headers.has('next-router-state-tree')
  ) {
    return false;
  }

  const fetchDest = headers.get('sec-fetch-dest')?.toLowerCase();
  return !fetchDest || fetchDest === 'document';
}
