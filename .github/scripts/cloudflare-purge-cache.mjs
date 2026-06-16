#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';

export function parsePurgeUrls(value) {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildPurgePayload(urls) {
  return {
    files: [...new Set(urls)],
  };
}

async function defaultFetchJson(path, { body, method = 'GET', token } = {}) {
  const response = await fetch(`${CLOUDFLARE_API_BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => null);

  if (!response.ok || !json?.success) {
    const details = json?.errors
      ?.map((error) => `${error.code ?? 'unknown'}:${error.message}`)
      .join('; ');
    throw new Error(
      `Cloudflare API request failed for ${path}: HTTP ${response.status}${
        details ? ` ${details}` : ''
      }`
    );
  }

  return json;
}

export async function discoverZoneId({ fetchJson = defaultFetchJson, token, zoneName }) {
  if (!zoneName) {
    throw new Error('CLOUDFLARE_ZONE_NAME is required when CLOUDFLARE_ZONE_ID is not set');
  }

  const params = new URLSearchParams({ name: zoneName });
  const json = await fetchJson(`/zones?${params.toString()}`, { token });
  const zoneId = json.result?.[0]?.id;

  if (!zoneId) {
    throw new Error(`Cloudflare zone not found for ${zoneName}`);
  }

  return zoneId;
}

export async function purgeCloudflareCache({
  fetchJson = defaultFetchJson,
  logger = console,
  token,
  urls,
  zoneId,
  zoneName,
}) {
  const uniqueUrls = [...new Set(urls ?? [])];

  if (!token) {
    logger.warn('Skipping Cloudflare purge: CLOUDFLARE_API_TOKEN is not set.');
    return { skipped: true, reason: 'missing-token' };
  }

  if (uniqueUrls.length === 0) {
    logger.warn('Skipping Cloudflare purge: no purge URLs were provided.');
    return { skipped: true, reason: 'missing-urls' };
  }

  const resolvedZoneId =
    zoneId || (await discoverZoneId({ fetchJson, token, zoneName }));
  const body = buildPurgePayload(uniqueUrls);
  await fetchJson(`/zones/${resolvedZoneId}/purge_cache`, {
    body,
    method: 'POST',
    token,
  });

  logger.log(`Purged ${uniqueUrls.length} Cloudflare URL(s) from zone ${resolvedZoneId}.`);
  return { purgedUrls: uniqueUrls, skipped: false, zoneId: resolvedZoneId };
}

async function main() {
  const urls = parsePurgeUrls(process.env.CLOUDFLARE_PURGE_URLS);
  await purgeCloudflareCache({
    token: process.env.CLOUDFLARE_API_TOKEN,
    urls,
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    zoneName: process.env.CLOUDFLARE_ZONE_NAME,
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
