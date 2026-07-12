#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
// Cloudflare single-file purge supports 100 operations per request on
// Free/Pro/Business plans as of the April 2026 Cache docs. Keep the deploy
// script at the portable non-Enterprise limit instead of assuming this list
// always stays small.
const CLOUDFLARE_SINGLE_FILE_PURGE_MAX_OPERATIONS = 100;
// Cloudflare accepts at most 30 hostnames in one hostname purge request.
const CLOUDFLARE_HOSTNAME_PURGE_MAX_OPERATIONS = 30;

function parsePurgeEntries(value) {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parsePurgeUrls(value) {
  return parsePurgeEntries(value);
}

export function parsePurgeHosts(value) {
  return parsePurgeEntries(value);
}

export function buildPurgePayload(urls) {
  return {
    files: [...new Set(urls)],
  };
}

export function buildHostnamePurgePayload(hosts) {
  return {
    hosts: [...new Set(hosts)],
  };
}

function chunkPurgeEntries(entries, size) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('Cloudflare purge chunk size must be a positive integer');
  }

  const chunks = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

export function chunkPurgeUrls(urls, size = CLOUDFLARE_SINGLE_FILE_PURGE_MAX_OPERATIONS) {
  return chunkPurgeEntries(urls, size);
}

export function chunkPurgeHosts(
  hosts,
  size = CLOUDFLARE_HOSTNAME_PURGE_MAX_OPERATIONS
) {
  return chunkPurgeEntries(hosts, size);
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
  hosts,
  logger = console,
  token,
  urls,
  zoneId,
  zoneName,
}) {
  const uniqueHosts = [...new Set(hosts ?? [])];
  const uniqueUrls = [...new Set(urls ?? [])];

  if (!token) {
    logger.warn('Skipping Cloudflare purge: CLOUDFLARE_API_TOKEN is not set.');
    return { skipped: true, reason: 'missing-token' };
  }

  if (uniqueHosts.length === 0 && uniqueUrls.length === 0) {
    logger.warn('Skipping Cloudflare purge: no purge targets were provided.');
    return { skipped: true, reason: 'missing-targets' };
  }

  const resolvedZoneId =
    zoneId || (await discoverZoneId({ fetchJson, token, zoneName }));
  const hostBatches = chunkPurgeHosts(uniqueHosts);
  const urlBatches = chunkPurgeUrls(uniqueUrls);

  for (const batch of hostBatches) {
    await fetchJson(`/zones/${resolvedZoneId}/purge_cache`, {
      body: buildHostnamePurgePayload(batch),
      method: 'POST',
      token,
    });
  }

  for (const batch of urlBatches) {
    await fetchJson(`/zones/${resolvedZoneId}/purge_cache`, {
      body: buildPurgePayload(batch),
      method: 'POST',
      token,
    });
  }

  logger.log(
    `Purged ${uniqueHosts.length} Cloudflare hostname(s) and ${uniqueUrls.length} URL(s) from zone ${resolvedZoneId} in ${hostBatches.length + urlBatches.length} request(s).`
  );
  return {
    purgedHosts: uniqueHosts,
    purgedUrls: uniqueUrls,
    skipped: false,
    zoneId: resolvedZoneId,
  };
}

async function main() {
  const hosts = parsePurgeHosts(process.env.CLOUDFLARE_PURGE_HOSTS);
  const urls = parsePurgeUrls(process.env.CLOUDFLARE_PURGE_URLS);
  await purgeCloudflareCache({
    hosts,
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
