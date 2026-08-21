import 'server-only';

import { z } from 'zod';
import { TIKTOK_ADS_API_ROOT } from './constants';

const DECIMAL = /^\d+(?:\.\d+)?$/;
const INTEGER = /^\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RETRIES = 3;
const MAX_PAGES = 20;

export class TikTokAdsProviderError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, status?: number) {
    super(code);
    this.code = code;
    this.name = 'TikTokAdsProviderError';
    this.status = status;
  }
}

export interface TikTokAdsAccount {
  accountId: string;
  currencyCode: string | null;
  label: string;
  timezoneName: string | null;
}
export interface TikTokAdsDailyReport {
  accountId: string;
  clicks: string;
  conversions: string;
  currencyCode: string;
  impressions: string;
  reach: string | null;
  spendAmountDecimal: string;
  spendDate: string;
  timezoneName: string;
}
export type TikTokAdsAsyncTaskStatus =
  | 'QUEUING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELED';

function payloadCode(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null;
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' || typeof code === 'number'
    ? String(code)
    : null;
}
function record(payload: unknown): Record<string, unknown> | null {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
}
function asInteger(value: unknown): string | null {
  const stringValue = typeof value === 'number' ? String(value) : value;
  return typeof stringValue === 'string' && INTEGER.test(stringValue)
    ? stringValue
    : null;
}
function waitMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get('retry-after'));
  return Math.min(
    300_000,
    Math.max(
      250 * 2 ** attempt,
      Number.isFinite(retryAfter) ? retryAfter * 1000 : 0
    )
  );
}

async function requestTikTokJson(
  url: URL,
  init: RequestInit,
  failureCode: string,
  fetchImpl: typeof fetch,
  sleep: (milliseconds: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms))
): Promise<unknown> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetchImpl(url, init);
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      /* Never retain provider bodies. */
    }
    const code = payloadCode(payload);
    // TikTok can return a success envelope with this header when its result is
    // truncated. Never persist partial spend as a successful daily snapshot.
    if (
      response.ok &&
      code === '0' &&
      !response.headers.has('x-tt-ads-throttle')
    )
      return payload;
    if (response.status === 401)
      throw new TikTokAdsProviderError(
        'TIKTOK_ADS_ACCESS_REVOKED',
        response.status
      );
    const throttled =
      response.status === 429 ||
      code === '40100' ||
      response.headers.has('x-tt-ads-throttle');
    if (!throttled && response.status < 500)
      throw new TikTokAdsProviderError(failureCode, response.status);
    if (attempt === MAX_RETRIES - 1)
      throw new TikTokAdsProviderError(
        throttled ? 'TIKTOK_ADS_THROTTLED' : failureCode,
        response.status
      );
    await sleep(waitMs(response, attempt));
  }
  throw new TikTokAdsProviderError(failureCode);
}

const accountSchema = z.object({
  advertiser_id: z.string().trim().min(1).max(255),
  advertiser_name: z.string().trim().min(1).max(255),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
  timezone: z.string().trim().min(1).max(128).optional(),
});

export async function listTikTokAdsAccounts(
  input: { accessToken: string; appId: string; appSecret: string },
  fetchImpl: typeof fetch = fetch,
  sleep?: (milliseconds: number) => Promise<void>
): Promise<TikTokAdsAccount[]> {
  const url = new URL(`${TIKTOK_ADS_API_ROOT}/oauth2/advertiser/get/`);
  url.searchParams.set('app_id', input.appId);
  url.searchParams.set('secret', input.appSecret);
  const payload = await requestTikTokJson(
    url,
    { headers: { 'Access-Token': input.accessToken } },
    'TIKTOK_ADS_ACCOUNT_DISCOVERY_FAILED',
    fetchImpl,
    sleep
  );
  const data = record(record(payload)?.data);
  const list = data?.list;
  if (!Array.isArray(list))
    throw new TikTokAdsProviderError('TIKTOK_ADS_ACCOUNT_DISCOVERY_INVALID');
  return list.flatMap((item) => {
    const parsed = accountSchema.safeParse(item);
    return parsed.success
      ? [
          {
            accountId: parsed.data.advertiser_id,
            currencyCode: parsed.data.currency ?? null,
            label: parsed.data.advertiser_name,
            timezoneName: parsed.data.timezone ?? null,
          },
        ]
      : [];
  });
}

function parseReportRows(
  payload: unknown,
  accountId: string
): TikTokAdsDailyReport[] {
  const data = record(record(payload)?.data);
  const list = data?.list;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    const row = record(item);
    if (!row || row.advertiser_id !== accountId) return [];
    const dimensions = record(row.dimensions);
    const metrics = record(row.metrics);
    const rawDate = dimensions?.stat_time_day;
    const date = typeof rawDate === 'string' ? rawDate.slice(0, 10) : '';
    const spend = metrics?.spend;
    const currency = metrics?.currency;
    const timezone = dimensions?.timezone ?? row.timezone;
    const impressions = asInteger(metrics?.impressions);
    const clicks = asInteger(metrics?.clicks);
    const conversions =
      typeof metrics?.conversion === 'string' &&
      DECIMAL.test(metrics.conversion)
        ? metrics.conversion
        : null;
    if (
      !ISO_DATE.test(date) ||
      typeof spend !== 'string' ||
      !DECIMAL.test(spend) ||
      typeof currency !== 'string' ||
      !/^[A-Z]{3}$/.test(currency) ||
      typeof timezone !== 'string' ||
      !timezone.trim() ||
      !impressions ||
      !clicks ||
      !conversions
    )
      return [];
    return [
      {
        accountId,
        clicks,
        conversions,
        currencyCode: currency,
        impressions,
        reach: asInteger(metrics?.reach),
        spendAmountDecimal: spend,
        spendDate: date,
        timezoneName: timezone,
      },
    ];
  });
}

function nextPage(payload: unknown): number | null {
  const page = record(record(payload)?.data)?.page_info;
  if (!record(page)) return null;
  const current = Number(record(page)?.page);
  const total = Number(record(page)?.total_page);
  return Number.isInteger(current) && Number.isInteger(total) && current < total
    ? current + 1
    : null;
}

export async function fetchTikTokAdsDailyReport(
  input: {
    accessToken: string;
    accountId: string;
    endDate: string;
    startDate: string;
  },
  fetchImpl: typeof fetch = fetch,
  sleep?: (milliseconds: number) => Promise<void>
): Promise<TikTokAdsDailyReport[]> {
  if (
    !input.accountId.trim() ||
    !ISO_DATE.test(input.startDate) ||
    !ISO_DATE.test(input.endDate) ||
    input.startDate > input.endDate
  )
    throw new TikTokAdsProviderError('TIKTOK_ADS_REPORT_INPUT_INVALID');
  const results: TikTokAdsDailyReport[] = [];
  let page = 1;
  for (let count = 0; count < MAX_PAGES; count += 1) {
    const url = new URL(`${TIKTOK_ADS_API_ROOT}/report/integrated/get/`);
    for (const [key, value] of Object.entries({
      advertiser_id: input.accountId,
      data_level: 'AUCTION_ADVERTISER',
      dimensions: JSON.stringify(['stat_time_day']),
      end_date: input.endDate,
      metrics: JSON.stringify([
        'spend',
        'impressions',
        'clicks',
        'conversion',
        'currency',
        'reach',
      ]),
      page: String(page),
      page_size: '1000',
      report_type: 'BASIC',
      service_type: 'AUCTION',
      start_date: input.startDate,
    }))
      url.searchParams.set(key, value);
    const payload = await requestTikTokJson(
      url,
      { headers: { 'Access-Token': input.accessToken } },
      'TIKTOK_ADS_REPORT_FAILED',
      fetchImpl,
      sleep
    );
    results.push(...parseReportRows(payload, input.accountId));
    const next = nextPage(payload);
    if (!next) return results;
    page = next;
  }
  throw new TikTokAdsProviderError('TIKTOK_ADS_REPORT_PAGING_LIMIT');
}

export function parseTikTokAdsAsyncTaskStatus(
  payload: unknown
): TikTokAdsAsyncTaskStatus | null {
  const status = record(record(payload)?.data)?.task_status;
  return status === 'QUEUING' ||
    status === 'PROCESSING' ||
    status === 'SUCCESS' ||
    status === 'FAILED' ||
    status === 'CANCELED'
    ? status
    : null;
}
