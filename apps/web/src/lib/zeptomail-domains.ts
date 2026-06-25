import 'server-only';

import {
  getZeptoMailAgentKey,
  getZohoClientId,
  getZohoClientSecret,
  getZohoRefreshToken,
} from '@/env';

/**
 * ZeptoMail Domains API client — registers a merchant's custom sending domain,
 * returns the DNS records they must add, and reports verification status.
 *
 * Auth: a Zoho OAuth self-client (scope `Zeptomail.Domains.All`). We hold a
 * long-lived refresh token and mint short-lived (1h) access tokens on demand,
 * caching them in module memory. All four env vars must be set for the feature
 * to work; callers should treat `isZeptomailDomainsConfigured()` as the gate.
 */

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZEPTOMAIL_API = 'https://api.zeptomail.com/v1.1';
const REQUEST_TIMEOUT_MS = 10_000;
// Subdomain that ZeptoMail uses for the bounce/return-path CNAME.
const BOUNCE_SUBDOMAIN_PREFIX = 'bounce-zem';

export interface ZeptomailDnsRecord {
  type: 'TXT' | 'CNAME';
  host: string;
  value: string;
}

export interface SendingDomainState {
  domainKey: string;
  domain: string;
  status: 'pending' | 'verified' | 'failed';
  verified: boolean;
  records: ZeptomailDnsRecord[];
}

interface ZeptomailDomainData {
  domain_name: string;
  domain_key: string;
  status?: string;
  domain_status?: string;
  dkim?: {
    host: string;
    public_key: string;
    selector?: string;
    status?: string;
  };
  cname?: { host: string; cname_record: string; status?: string };
}

interface ZeptomailDomainsResponse {
  data?: ZeptomailDomainData | ZeptomailDomainData[];
  message?: string;
}

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
    const message =
      (json as { message?: string } | null)?.message ??
      `ZeptoMail API error (${response.status})`;
    throw new Error(message);
  }
  return json;
}

function domainRows(json: unknown): ZeptomailDomainData[] {
  const data = (json as ZeptomailDomainsResponse | null)?.data;
  if (!data) {
    return [];
  }
  return Array.isArray(data) ? data : [data];
}

function firstDomain(json: unknown): ZeptomailDomainData {
  const data = domainRows(json);
  if (!data.length) {
    throw new Error('ZeptoMail returned no domain data');
  }
  return data[0];
}

function toSendingDomainState(data: ZeptomailDomainData): SendingDomainState {
  const records: ZeptomailDnsRecord[] = [];
  if (data.dkim) {
    records.push({
      type: 'TXT',
      host: data.dkim.host,
      value: data.dkim.public_key,
    });
  }
  if (data.cname) {
    records.push({
      type: 'CNAME',
      host: data.cname.host,
      value: data.cname.cname_record,
    });
  }
  const verified =
    data.dkim?.status === 'verified' && data.cname?.status === 'verified';
  const status = toVerificationStatus(data, verified);
  return {
    domainKey: data.domain_key,
    domain: data.domain_name,
    status,
    verified,
    records,
  };
}

function toVerificationStatus(
  data: ZeptomailDomainData,
  verified: boolean
): SendingDomainState['status'] {
  if (verified) {
    return 'verified';
  }
  const values = [
    data.status,
    data.domain_status,
    data.dkim?.status,
    data.cname?.status,
  ].map((value) => value?.toLowerCase() ?? '');
  return values.some((value) => value.includes('fail')) ? 'failed' : 'pending';
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
