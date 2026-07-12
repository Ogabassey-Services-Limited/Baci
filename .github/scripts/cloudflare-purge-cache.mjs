#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
// Cloudflare single-file purge supports 100 operations per request on
// Free/Pro/Business plans as of the April 2026 Cache docs. Keep the deploy
// script at the portable non-Enterprise limit instead of assuming this list
// always stays small.
const CLOUDFLARE_SINGLE_FILE_PURGE_MAX_OPERATIONS = 100;

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

export function chunkPurgeUrls(urls, size = CLOUDFLARE_SINGLE_FILE_PURGE_MAX_OPERATIONS) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('Cloudflare purge chunk size must be a positive integer');
  }

  const chunks = [];
  for (let index = 0; index < urls.length; index += size) {
    chunks.push(urls.slice(index, index + size));
  }
  return chunks;
}

export async function fetchCloudflareJson(
  path,
  { body, fetchImpl = fetch, method = 'GET', token } = {}
) {
  const response = await fetchImpl(`${CLOUDFLARE_API_BASE_URL}${path}`, {
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
    const error = new Error(
      `Cloudflare API request failed for ${path}: HTTP ${response.status}${
        details ? ` ${details}` : ''
      }`
    );
    error.status = response.status;
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const retryAt = Number.isFinite(seconds)
        ? Date.now() + seconds * 1000
        : Date.parse(retryAfter);
      if (Number.isFinite(retryAt)) {
        error.retryAfterMs = Math.max(0, retryAt - Date.now());
      }
    }
    throw error;
  }

  return json;
}

export async function discoverZoneId({ fetchJson = fetchCloudflareJson, token, zoneName }) {
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
  fetchJson = fetchCloudflareJson,
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
  const batches = chunkPurgeUrls(uniqueUrls);
  for (const batch of batches) {
    await fetchJson(`/zones/${resolvedZoneId}/purge_cache`, {
      body: buildPurgePayload(batch),
      method: 'POST',
      token,
    });
  }

  logger.log(
    `Purged ${uniqueUrls.length} Cloudflare URL(s) from zone ${resolvedZoneId} in ${batches.length} request(s).`
  );
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
