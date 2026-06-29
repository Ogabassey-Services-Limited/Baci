import 'server-only';

import {
  getZeptoMailAgentKey,
  getZohoClientId,
  getZohoClientSecret,
  getZohoRefreshToken,
} from '@/env';
import {
  domainRows,
  firstDomain,
  isAssociatedWithConfiguredMailagent,
  mergeSendingDomainState,
  type SendingDomainState,
  toSendingDomainState,
  type ZeptomailDnsRecord,
} from '@/lib/zeptomail-domains-mapping';

export type { SendingDomainState, ZeptomailDnsRecord };
export { isAssociatedWithConfiguredMailagent };

/**
 * ZeptoMail Domains API client — registers a merchant's custom sending domain,
 * returns the DNS records they must add, and reports verification status.
 *
 * Auth: a Zoho OAuth self-client (scope `Zeptomail.Domains.All`). We hold a
 * long-lived refresh token and mint short-lived (1h) access tokens on demand,
 * caching them in module memory. All four env vars must be set for the feature
 * to work; callers should treat `isZeptomailDomainsConfigured()` as the gate.
 *
 * Response normalization lives in zeptomail-domains-mapping.ts.
 */

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZEPTOMAIL_API = 'https://api.zeptomail.com/v1.1';
const REQUEST_TIMEOUT_MS = 10_000;
// Subdomain that ZeptoMail uses for the bounce/return-path CNAME.
const BOUNCE_SUBDOMAIN_PREFIX = 'bounce-zem';

function getCredentials() {
  const clientId = getZohoClientId();
  const clientSecret = getZohoClientSecret();
  const refreshToken = getZohoRefreshToken();
  const mailagentKey = getZeptoMailAgentKey();
  if (!(clientId && clientSecret && refreshToken && mailagentKey)) {
    throw new Error('ZeptoMail Domains API is not configured');
  }
  return { clientId, clientSecret, refreshToken, mailagentKey };
}

/** Whether all credentials are present (gate the feature on this). */
export function isZeptomailDomainsConfigured(): boolean {
  return Boolean(
    getZohoClientId() &&
      getZohoClientSecret() &&
      getZohoRefreshToken() &&
      getZeptoMailAgentKey()
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken(): Promise<string> {
  // Re-use a cached token until ~1 minute before expiry.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const { clientId, clientSecret, refreshToken } = getCredentials();
  const response = await fetchWithTimeout(ZOHO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const json = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  if (!(response.ok && json?.access_token)) {
    throw new Error('Failed to obtain a ZeptoMail access token');
  }
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return cachedToken.value;
}

async function zeptomailRequest(
  path: string,
  init: RequestInit
): Promise<unknown> {
  const token = await getAccessToken();
  const response = await fetchWithTimeout(`${ZEPTOMAIL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    // ZeptoMail error responses nest the human-readable message under `error`
    // (see Zoho's error-codes docs), e.g. the "domain already exists/verified"
    // case. Read the nested message first so callers like
    // getRegisterableSendingDomain can detect it and recover, rather than
    // surfacing an opaque "ZeptoMail API error (400)".
    const errorBody = json as {
      message?: string;
      error?: {
        message?: string;
        details?: Array<{ message?: string }>;
      };
    } | null;
    const message =
      errorBody?.error?.message ??
      errorBody?.error?.details?.find((detail) => detail?.message)?.message ??
      errorBody?.message ??
      `ZeptoMail API error (${response.status})`;
    throw new Error(message);
  }
  return json;
}

export async function associateSendingDomainWithConfiguredMailagent(
  state: SendingDomainState
): Promise<SendingDomainState> {
  if (isAssociatedWithConfiguredMailagent(state)) {
    return state;
  }

  const { mailagentKey } = getCredentials();
  const json = await zeptomailRequest(`/domains/${state.domainKey}`, {
    method: 'PUT',
    body: JSON.stringify({
      associate_mailagents: [mailagentKey],
    }),
  });
  const associated = mergeSendingDomainState(
    state,
    toSendingDomainState(firstDomain(json))
  );
  if (!isAssociatedWithConfiguredMailagent(associated)) {
    throw new Error('Sending domain is not associated with this mail agent');
  }

  // Zoho's edit-domain response can omit DNS record fields such as dkim.host.
  // Refetch the canonical domain after association so callers persist the full
  // DKIM/CNAME verification records shown to the merchant.
  const refreshed = await getSendingDomain(state.domainKey);
  return mergeSendingDomainState(associated, refreshed);
}

/** Register a sending domain; returns the DNS records the merchant must add. */
export async function registerSendingDomain(
  domain: string
): Promise<SendingDomainState> {
  const { mailagentKey } = getCredentials();
  const json = await zeptomailRequest('/domains', {
    method: 'POST',
    body: JSON.stringify({
      domain_name: domain,
      mailagent_keys: [mailagentKey],
      sub_domain_prefix: BOUNCE_SUBDOMAIN_PREFIX,
    }),
  });
  return toSendingDomainState(firstDomain(json));
}

/** List domains and return the current ZeptoMail state for a domain name. */
export async function findSendingDomainByName(
  domain: string
): Promise<SendingDomainState | null> {
  const json = await zeptomailRequest('/domains', { method: 'GET' });
  const normalizedDomain = domain.toLowerCase();
  const match = domainRows(json).find(
    (entry) => entry.domain_name.toLowerCase() === normalizedDomain
  );
  return match ? getSendingDomain(match.domain_key) : null;
}

/** Read a domain's current DNS-record state + verification status. */
export async function getSendingDomain(
  domainKey: string
): Promise<SendingDomainState> {
  const json = await zeptomailRequest(`/domains/${domainKey}`, {
    method: 'GET',
  });
  return toSendingDomainState(firstDomain(json));
}

/** Ask ZeptoMail to validate DKIM/CNAME records, then return current state. */
export async function verifySendingDomain(
  domainKey: string
): Promise<SendingDomainState> {
  const json = await zeptomailRequest(`/domains/${domainKey}/verify`, {
    method: 'PUT',
  });
  return toSendingDomainState(firstDomain(json));
}
