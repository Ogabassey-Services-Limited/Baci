import 'server-only';

import { z } from 'zod';
import type { GoogleAdsReportingConfig } from '@/lib/google-ads/config';
import {
  GOOGLE_ADS_TOKEN_ENDPOINT,
  type GoogleAdsSpendRow,
  parseGoogleAdsSpendRows,
} from '@/lib/google-ads/oauth';

export const GOOGLE_ADS_DEFAULT_API_VERSION = 'v25' as const;

export function getGoogleAdsApiRoot(): string {
  const version =
    process.env.GOOGLE_ADS_API_VERSION?.trim() ||
    GOOGLE_ADS_DEFAULT_API_VERSION;
  if (!/^v\d+$/.test(version)) {
    throw new GoogleAdsProviderError('GOOGLE_ADS_API_VERSION_INVALID');
  }
  return `https://googleads.googleapis.com/${version}`;
}

export class GoogleAdsProviderError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, status?: number) {
    super(code);
    this.name = 'GoogleAdsProviderError';
    this.code = code;
    this.status = status;
  }
}

const refreshedTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().int().positive().optional(),
});

function providerHeaders(
  accessToken: string,
  reportingConfig: GoogleAdsReportingConfig
): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': reportingConfig.developerToken,
    ...(reportingConfig.loginCustomerId
      ? { 'login-customer-id': reportingConfig.loginCustomerId }
      : {}),
  };
}

const GOOGLE_ADS_MANAGER_DISCOVERY_QUERY = [
  'SELECT customer_client.client_customer, customer_client.level,',
  'customer_client.manager',
  'FROM customer_client',
  'WHERE customer_client.level <= 1',
].join(' ');

const GOOGLE_ADS_MAX_MANAGER_DEPTH = 5;
const GOOGLE_ADS_MAX_DISCOVERED_CUSTOMERS = 1_000;
const GOOGLE_ADS_MAX_MANAGER_PROBES = 20;
const GOOGLE_ADS_MANAGER_DISCOVERY_CONCURRENCY = 4;

type GoogleAdsManagerClient = {
  customerId: string;
  manager: boolean;
};

function parseGoogleAdsCustomerId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const customerId = value.replace(/^customers\//, '');
  return /^\d{10}$/.test(customerId) ? customerId : null;
}

async function listGoogleAdsManagerClients(
  customerId: string,
  accessToken: string,
  reportingConfig: GoogleAdsReportingConfig,
  fetchImpl: typeof fetch
): Promise<GoogleAdsManagerClient[]> {
  const response = await fetchImpl(
    `${getGoogleAdsApiRoot()}/customers/${customerId}/googleAds:searchStream`,
    {
      body: JSON.stringify({ query: GOOGLE_ADS_MANAGER_DISCOVERY_QUERY }),
      headers: {
        ...providerHeaders(accessToken, reportingConfig),
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }
  );
  // A normal, non-manager customer rejects the customer_client query. It is
  // still a valid directly accessible account, so there are no descendants.
  if (response.status === 400 || response.status === 404) return [];
  if (!response.ok) {
    throw new GoogleAdsProviderError(
      'GOOGLE_ADS_MANAGER_ACCOUNT_DISCOVERY_FAILED',
      response.status
    );
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new GoogleAdsProviderError(
      'GOOGLE_ADS_MANAGER_ACCOUNT_DISCOVERY_RESPONSE_INVALID'
    );
  }
  const clients: GoogleAdsManagerClient[] = [];
  for (const batch of payload) {
    if (
      batch === null ||
      typeof batch !== 'object' ||
      !Array.isArray((batch as { results?: unknown }).results)
    ) {
      continue;
    }
    for (const result of (batch as { results: unknown[] }).results) {
      if (result === null || typeof result !== 'object') continue;
      const customerClient = (result as { customerClient?: unknown })
        .customerClient;
      if (customerClient === null || typeof customerClient !== 'object') {
        continue;
      }
      const parsedCustomerId = parseGoogleAdsCustomerId(
        (customerClient as { clientCustomer?: unknown }).clientCustomer
      );
      if (!parsedCustomerId) continue;
      clients.push({
        customerId: parsedCustomerId,
        manager: (customerClient as { manager?: unknown }).manager === true,
      });
    }
  }
  return clients;
}

export async function refreshGoogleAdsAccessToken(
  input: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<{ accessToken: string; expiresAt: string | null }> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: input.refreshToken,
  });
  const response = await fetchImpl(GOOGLE_ADS_TOKEN_ENDPOINT, {
    body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    method: 'POST',
  });
  if (!response.ok) {
    throw new GoogleAdsProviderError(
      'GOOGLE_ADS_ACCESS_TOKEN_REFRESH_FAILED',
      response.status
    );
  }
  const parsed = refreshedTokenSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new GoogleAdsProviderError(
      'GOOGLE_ADS_ACCESS_TOKEN_RESPONSE_INVALID'
    );
  }
  return {
    accessToken: parsed.data.access_token,
    expiresAt: parsed.data.expires_in
      ? new Date(Date.now() + parsed.data.expires_in * 1000).toISOString()
      : null,
  };
}

export async function listGoogleAdsAccessibleCustomerIds(
  accessToken: string,
  reportingConfig: GoogleAdsReportingConfig,
  fetchImpl: typeof fetch = fetch
): Promise<string[]> {
  const response = await fetchImpl(
    `${getGoogleAdsApiRoot()}/customers:listAccessibleCustomers`,
    { headers: providerHeaders(accessToken, reportingConfig) }
  );
  if (!response.ok) {
    throw new GoogleAdsProviderError(
      'GOOGLE_ADS_ACCOUNT_DISCOVERY_FAILED',
      response.status
    );
  }
  const payload: unknown = await response.json();
  const resourceNames =
    payload !== null &&
    typeof payload === 'object' &&
    Array.isArray((payload as { resourceNames?: unknown }).resourceNames)
      ? (payload as { resourceNames: unknown[] }).resourceNames
      : [];
  const directCustomerIds = resourceNames
    .filter((value: unknown): value is string => typeof value === 'string')
    .map(parseGoogleAdsCustomerId)
    .filter((value: string | null): value is string => value !== null);

  const discoveredCustomerIds = new Set(directCustomerIds);
  const queue = directCustomerIds.map((id) => ({ depth: 0, id }));
  const visitedManagers = new Set<string>();
  let probes = 0;
  while (
    queue.length > 0 &&
    discoveredCustomerIds.size < GOOGLE_ADS_MAX_DISCOVERED_CUSTOMERS &&
    probes < GOOGLE_ADS_MAX_MANAGER_PROBES
  ) {
    const batch = [];
    while (
      batch.length < GOOGLE_ADS_MANAGER_DISCOVERY_CONCURRENCY &&
      queue.length > 0 &&
      probes + batch.length < GOOGLE_ADS_MAX_MANAGER_PROBES
    ) {
      const next = queue.shift();
      if (
        next &&
        !visitedManagers.has(next.id) &&
        next.depth < GOOGLE_ADS_MAX_MANAGER_DEPTH
      ) {
        visitedManagers.add(next.id);
        batch.push(next);
      }
    }
    if (batch.length === 0) continue;
    probes += batch.length;
    const results = await Promise.all(
      batch.map(async (next) => ({
        clients: await listGoogleAdsManagerClients(
          next.id,
          accessToken,
          reportingConfig,
          fetchImpl
        ),
        depth: next.depth,
      }))
    );
    for (const result of results) {
      for (const client of result.clients) {
        discoveredCustomerIds.add(client.customerId);
        if (
          client.manager &&
          !visitedManagers.has(client.customerId) &&
          discoveredCustomerIds.size < GOOGLE_ADS_MAX_DISCOVERED_CUSTOMERS
        ) {
          queue.push({ depth: result.depth + 1, id: client.customerId });
        }
      }
    }
  }

  return [...discoveredCustomerIds];
}

export async function fetchGoogleAdsDailySpend(
  input: {
    accessToken: string;
    customerId: string;
    endDate: string;
    reportingConfig: GoogleAdsReportingConfig;
    startDate: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<GoogleAdsSpendRow[]> {
  if (!/^\d{10}$/.test(input.customerId)) {
    throw new GoogleAdsProviderError('GOOGLE_ADS_CUSTOMER_ID_INVALID');
  }
  const query = [
    'SELECT customer.id, customer.currency_code, segments.date, metrics.cost_micros,',
    'metrics.impressions, metrics.clicks, metrics.conversions',
    'FROM customer',
    `WHERE segments.date BETWEEN '${input.startDate}' AND '${input.endDate}'`,
  ].join(' ');
  const response = await fetchImpl(
    `${getGoogleAdsApiRoot()}/customers/${input.customerId}/googleAds:searchStream`,
    {
      body: JSON.stringify({ query }),
      headers: {
        ...providerHeaders(input.accessToken, input.reportingConfig),
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }
  );
  if (!response.ok) {
    throw new GoogleAdsProviderError(
      'GOOGLE_ADS_SPEND_QUERY_FAILED',
      response.status
    );
  }
  return parseGoogleAdsSpendRows(await response.json());
}
