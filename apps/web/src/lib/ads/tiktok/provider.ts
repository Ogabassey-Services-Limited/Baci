import 'server-only';

import { z } from 'zod';
import { TIKTOK_ADS_API_ROOT } from './constants';
import { requestTikTokAdsJson, TikTokAdsProviderError } from './request';

const DECIMAL = /^\d+(?:\.\d+)?$/;
const INTEGER = /^\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PAGES = 20;

export { TikTokAdsProviderError } from './request';

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

function record(payload: unknown): Record<string, unknown> | null {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
}
function asInteger(value: unknown): string | null {
  return typeof value === 'string' && INTEGER.test(value) ? value : null;
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
  const payload = await requestTikTokAdsJson(
    url,
    { headers: { 'Access-Token': input.accessToken } },
    'TIKTOK_ADS_ACCOUNT_DISCOVERY_FAILED',
    fetchImpl,
    { sleep }
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
  fallback: {
    accountId: string;
    currencyCode: string | null;
    timezoneName: string | null;
  }
): TikTokAdsDailyReport[] {
  const data = record(record(payload)?.data);
  const list = data?.list;
  if (!Array.isArray(list))
    throw new TikTokAdsProviderError('TIKTOK_ADS_REPORT_RESPONSE_INVALID');
  const parsedRows = list.flatMap((item) => {
    const row = record(item);
    if (!row) return [];
    const dimensions = record(row.dimensions);
    const metrics = record(row.metrics);
    const advertiserId = dimensions?.advertiser_id ?? row.advertiser_id;
    const rawDate = dimensions?.stat_time_day;
    const date = typeof rawDate === 'string' ? rawDate.slice(0, 10) : '';
    const spend = metrics?.spend;
    const currency = metrics?.currency ?? fallback.currencyCode;
    const timezone =
      dimensions?.timezone ?? row.timezone ?? fallback.timezoneName;
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
      (advertiserId !== undefined && advertiserId !== fallback.accountId) ||
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
        accountId: fallback.accountId,
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
  if (list.length > 0 && parsedRows.length !== list.length)
    throw new TikTokAdsProviderError('TIKTOK_ADS_REPORT_ROWS_INVALID');
  return parsedRows;
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
    currencyCode?: string | null;
    endDate: string;
    startDate: string;
    timezoneName?: string | null;
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
      dimensions: JSON.stringify(['advertiser_id', 'stat_time_day']),
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
    const payload = await requestTikTokAdsJson(
      url,
      { headers: { 'Access-Token': input.accessToken } },
      'TIKTOK_ADS_REPORT_FAILED',
      fetchImpl,
      { sleep }
    );
    results.push(
      ...parseReportRows(payload, {
        accountId: input.accountId,
        currencyCode: input.currencyCode ?? null,
        timezoneName: input.timezoneName ?? null,
      })
    );
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
