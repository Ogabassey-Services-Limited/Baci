import { setTimeout as sleep } from 'node:timers/promises';

const REQUEST_TIMEOUT_MS = 30_000;
const TOKEN_REFRESH_BUFFER_MS = 60_000;
const MAX_PAGES = 1000;

function getJumiaBaseUrl() {
  return process.env.JUMIA_ENVIRONMENT === 'staging'
    ? 'https://vendor-api-staging.jumia.com'
    : 'https://vendor-api.jumia.com';
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Request to ${url} timed out after ${REQUEST_TIMEOUT_MS}ms`,
        { cause: error }
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function needsRefresh(integration) {
  if (!integration.access_token || !integration.token_expires_at) return true;
  const expiresAt = new Date(integration.token_expires_at).getTime();
  if (!Number.isFinite(expiresAt)) return true;
  return Date.now() >= expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

export async function refreshAccessToken(supabase, integration) {
  if (!integration.refresh_token?.trim()) {
    throw new Error(
      'Refresh token is missing or invalid — user re-authorization required'
    );
  }
  if (!process.env.JUMIA_CLIENT_ID) {
    throw new Error('JUMIA_CLIENT_ID is missing from environment');
  }

  const response = await fetchWithTimeout(`${getJumiaBaseUrl()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
      client_id: process.env.JUMIA_CLIENT_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Token refresh failed: HTTP ${response.status} ${await response.text()}`
    );
  }

  const data = await response.json();
  const expiresInSeconds = Number.parseInt(String(data.expires_in ?? ''), 10);
  if (!data.access_token) {
    throw new Error('Token refresh response did not include an access token');
  }
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error('Token refresh response included an invalid expires_in');
  }

  integration.access_token = data.access_token;
  integration.refresh_token = data.refresh_token || integration.refresh_token;
  integration.token_expires_at = new Date(
    Date.now() + expiresInSeconds * 1000
  ).toISOString();

  const { error } = await supabase
    .from('marketplace_integrations')
    .update({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
      token_expires_at: integration.token_expires_at,
    })
    .eq('id', integration.id)
    .eq('merchant_id', integration.merchant_id);

  if (error) {
    throw new Error(`Failed to persist refreshed token: ${error.message}`);
  }
}

async function getValidToken(supabase, integration) {
  if (needsRefresh(integration))
    await refreshAccessToken(supabase, integration);
  if (!integration.access_token) {
    throw new Error('No Jumia access token available');
  }
  return integration.access_token;
}

async function requestJumia(supabase, integration, method, path) {
  const token = await getValidToken(supabase, integration);
  let response = await fetchWithTimeout(`${getJumiaBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    await refreshAccessToken(supabase, integration);
    response = await fetchWithTimeout(`${getJumiaBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  if (!response.ok) {
    throw new Error(
      `Jumia API Error (${response.status}): ${await response.text()}`
    );
  }

  return await response.json();
}

export async function getAllOrders(supabase, integration, params) {
  const all = [];
  let nextToken = null;
  let pageCount = 0;

  do {
    if (++pageCount > MAX_PAGES) {
      throw new Error(`getAllOrders exceeded ${MAX_PAGES} pages`);
    }

    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, nextToken })) {
      if (value != null && value !== '') query.set(key, String(value));
    }

    const response = await requestJumia(
      supabase,
      integration,
      'GET',
      `/orders?${query.toString()}`
    );
    all.push(...(response.orders ?? []));
    nextToken = response.nextToken ?? null;
    if (response.isLastPage) break;
    if (!nextToken) {
      throw new Error(
        'Jumia orders response was not last page but returned no nextToken'
      );
    }

    await sleep(150);
  } while (nextToken);

  return all;
}

export async function getOrderItems(supabase, integration, orderId) {
  const params = new URLSearchParams({ orderId });
  const response = await requestJumia(
    supabase,
    integration,
    'GET',
    `/orders/items?${params.toString()}`
  );
  return response.items ?? [];
}
