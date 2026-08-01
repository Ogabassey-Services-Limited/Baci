export const DEFAULT_INDEXNOW_KEY = '0751d5c882ab3d7c013ecbfe9e624d71';
export const DEFAULT_INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_RESPONSE_BODY_LENGTH = 500;
const DEFAULT_INDEXNOW_REQUEST_TIMEOUT_MS = 5000;

export interface IndexNowPayload {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
}

interface IndexNowFetchResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

type IndexNowFetch = (
  input: string,
  init: RequestInit
) => Promise<IndexNowFetchResponse>;

export type IndexNowSubmitResult =
  | {
      reason: 'missing_key' | 'no_valid_urls';
      status: 'skipped';
      submitted: 0;
    }
  | {
      endpoint: string;
      responseStatus: number;
      status: 'submitted';
      submitted: number;
    }
  | {
      endpoint: string;
      responseBody: string;
      responseStatus: number;
      status: 'failed';
      submitted: number;
    };

interface BuildIndexNowPayloadOptions {
  host: string;
  key?: string;
  urls: string[];
}

interface SubmitIndexNowUrlsOptions extends BuildIndexNowPayloadOptions {
  endpoint?: string;
  fetchImpl?: IndexNowFetch;
  timeoutMs?: number;
}

function getUnknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'IndexNow request failed';
}

function normalizeIndexNowHost(host: string): string | null {
  const trimmedHost = host.trim().toLowerCase();
  if (!trimmedHost) {
    return null;
  }

  const withProtocol = trimmedHost.includes('://')
    ? trimmedHost
    : `https://${trimmedHost}`;

  try {
    return new URL(withProtocol).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalizeOwnedUrl(rawUrl: string, host: string): string | null {
  try {
    const url = new URL(rawUrl);
    const normalizedUrlHost = url.hostname.toLowerCase().replace(/^www\./, '');

    if (url.protocol !== 'https:' || normalizedUrlHost !== host) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function getIndexNowHostFromIdentifiers(
  identifiers: readonly string[] | undefined
): string | null {
  return (
    identifiers?.find(
      (identifier) => identifier.includes('.') && !identifier.includes('/')
    ) ?? null
  );
}

export function buildIndexNowBlogPostUrl(
  host: string,
  slug: unknown
): string | null {
  const normalizedHost = normalizeIndexNowHost(host);
  if (!normalizedHost || typeof slug !== 'string' || !slug.trim()) {
    return null;
  }

  return `https://${normalizedHost}/blog/${encodeURIComponent(slug.trim())}`;
}

export function buildIndexNowPayload({
  host,
  key = DEFAULT_INDEXNOW_KEY,
  urls,
}: BuildIndexNowPayloadOptions): IndexNowPayload | null {
  const normalizedHost = normalizeIndexNowHost(host);
  const trimmedKey = key.trim();

  if (!normalizedHost || !trimmedKey) {
    return null;
  }

  const urlList = Array.from(
    new Set(
      urls
        .map((url) => normalizeOwnedUrl(url, normalizedHost))
        .filter((url): url is string => Boolean(url))
    )
  );

  if (urlList.length === 0) {
    return null;
  }

  return {
    host: normalizedHost,
    key: trimmedKey,
    keyLocation: `https://${normalizedHost}/${trimmedKey}.txt`,
    urlList,
  };
}

export async function submitIndexNowUrls({
  endpoint = DEFAULT_INDEXNOW_ENDPOINT,
  fetchImpl = fetch,
  host,
  key = DEFAULT_INDEXNOW_KEY,
  timeoutMs = DEFAULT_INDEXNOW_REQUEST_TIMEOUT_MS,
  urls,
}: SubmitIndexNowUrlsOptions): Promise<IndexNowSubmitResult> {
  if (!key.trim()) {
    return { reason: 'missing_key', status: 'skipped', submitted: 0 };
  }

  const payload = buildIndexNowPayload({ host, key, urls });
  if (!payload) {
    return { reason: 'no_valid_urls', status: 'skipped', submitted: 0 };
  }

  const controller = new AbortController();
  const timeout =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  let response: IndexNowFetchResponse;
  try {
    response = await fetchImpl(endpoint, {
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      method: 'POST',
      signal: controller.signal,
    });
  } catch (error) {
    return {
      endpoint,
      responseBody: getUnknownErrorMessage(error),
      responseStatus: 0,
      status: 'failed',
      submitted: payload.urlList.length,
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  if (response.ok) {
    return {
      endpoint,
      responseStatus: response.status,
      status: 'submitted',
      submitted: payload.urlList.length,
    };
  }

  let responseBody: string;
  try {
    responseBody = (await response.text()).slice(0, MAX_RESPONSE_BODY_LENGTH);
  } catch (error) {
    responseBody = getUnknownErrorMessage(error).slice(
      0,
      MAX_RESPONSE_BODY_LENGTH
    );
  }

  return {
    endpoint,
    responseBody,
    responseStatus: response.status,
    status: 'failed',
    submitted: payload.urlList.length,
  };
}
