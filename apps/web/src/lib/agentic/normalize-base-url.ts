export function normalizeBaseUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const parsedUrl = new URL(normalizedBaseUrl);

  return parsedUrl.toString().replace(/\/+$/, '');
}
