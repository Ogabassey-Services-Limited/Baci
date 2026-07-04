import type { DomainSearchResult } from './domain-search-result';

const FALLBACK_DOMAIN_API_BASE_URL = 'https://usebaci.com';

function resolveDomainApiBaseUrl(): string {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_WEB_API_URL?.trim();

  if (!configuredBaseUrl) {
    return FALLBACK_DOMAIN_API_BASE_URL;
  }

  try {
    const normalizedBaseUrl = configuredBaseUrl.startsWith('http')
      ? configuredBaseUrl
      : `https://${configuredBaseUrl}`;

    return new URL(normalizedBaseUrl).toString().replace(/\/$/, '');
  } catch {
    return FALLBACK_DOMAIN_API_BASE_URL;
  }
}

const DOMAIN_API_BASE_URL = resolveDomainApiBaseUrl();

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

/**
 * The web API emits HTTP 402 with body { code: 'requires_upgrade' } ONLY from
 * the merchant plan gate (merchantFeatureUpgradeResponse). Every genuine
 * failure uses 400/401/403/404/500/502, so a 402 — or an explicit
 * requires_upgrade code — is an unambiguous "route the merchant to upgrade"
 * signal rather than a dead-end error. Google Play rejects paywalls whose
 * buttons surface such a gate as a raw failure dialog with no path forward.
 */
export const REQUIRES_UPGRADE_CODE = 'requires_upgrade';

export class DomainUpgradeRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainUpgradeRequiredError';
  }
}

export function isUpgradeRequiredResponse(
  status: number,
  code?: string | null
): boolean {
  return status === 402 || code === REQUIRES_UPGRADE_CODE;
}

export function extractErrorCode(rawBody: string): string | undefined {
  if (!rawBody) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawBody) as { code?: unknown };
    return typeof parsed.code === 'string' ? parsed.code : undefined;
  } catch {
    return undefined;
  }
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
  results: DomainSearchResult[],
  defaultCurrency: string
): DomainSearchResult[] {
  return results.map((result) => {
    const normalizedCurrency = (result.currency || '').trim();
    return {
      domain: result.domain,
      available: result.available,
      price: result.price,
      currency: normalizedCurrency || defaultCurrency,
      popular: result.popular,
    };
  });
}
