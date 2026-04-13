import type { DomainSearchResult } from './domain-search-result';

const DOMAIN_API_BASE_URL = 'https://usebaci.com';

export const API_URL = getApiUrl();

function getApiUrl(): string {
  if (__DEV__) {
    console.log(
      `[Diagnostic] Base API URL forced to: "${DOMAIN_API_BASE_URL}"`
    );
  }

  const url = DOMAIN_API_BASE_URL.startsWith('http')
    ? DOMAIN_API_BASE_URL
    : `https://${DOMAIN_API_BASE_URL}`;
  const finalUrl = url.endsWith('/api') ? url : `${url.replace(/\/$/, '')}/api`;

  if (__DEV__) {
    console.log(`[Diagnostic] Final computed API URL: "${finalUrl}"`);
  }

  return finalUrl;
}

export function getPaymentInitializationErrorMessage(
  response: Response,
  rawBody: string
): string {
  const fallbackMessage = `Payment initialization failed (${response.status})`;

  if (!rawBody) {
    return fallbackMessage;
  }

  try {
    const parsed = JSON.parse(rawBody) as { error?: string; message?: string };
    const details =
      typeof parsed.error === 'string'
        ? parsed.error
        : typeof parsed.message === 'string'
          ? parsed.message
          : rawBody;

    return `${fallbackMessage}: ${details}`;
  } catch {
    return `${fallbackMessage}: ${rawBody}`;
  }
}

export function normalizeDomainSearchResults(
  results: DomainSearchResult[]
): DomainSearchResult[] {
  return results.map((result) => ({
    domain: result.domain,
    available: result.available,
    price: result.price,
    currency: result.currency || 'NGN',
    popular: result.popular,
  }));
}
