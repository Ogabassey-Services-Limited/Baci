import 'server-only';

import { z } from 'zod';
import { META_ADS_GRAPH_ROOT } from './oauth';

const MAX_ACCOUNT_PAGES = 20;
const MAX_INSIGHTS_PAGES = 20;
const MAX_RETRIES = 3;
const RETRYABLE_META_CODES = new Set([4, 17, 613, 80000, 80003, 80004, 80014]);
const DECIMAL = /^\d+(?:\.\d+)?$/;
const INTEGER = /^\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class MetaAdsProviderError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, status?: number) {
    super(code);
    this.code = code;
    this.name = 'MetaAdsProviderError';
    this.status = status;
  }
}

export interface MetaAdsAccount {
  accountId: string;
  currencyCode: string;
  label: string;
  timezoneName: string;
  timezoneOffsetHours: string | null;
}

export interface MetaActionValue {
  actionType: string;
  value: string;
}

export interface MetaAdsDailyInsight {
  accountId: string;
  actions: MetaActionValue[];
  actionValues: MetaActionValue[];
  attributionSetting: string | null;
  clicks: string;
  dateStart: string;
  dateStop: string;
  impressions: string;
  reach: string | null;
  spendAmountDecimal: string;
}

export interface MetaAdsUsageTelemetry {
  adAccountCallCount: number | null;
  businessUseCaseCallCount: number | null;
  insightsThrottleResetSeconds: number | null;
}

const accountSchema = z.object({
  account_id: z.string().regex(/^\d+$/).optional(),
  account_status: z.union([z.number(), z.string()]).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  id: z.string().regex(/^act_\d+$/),
  name: z.string().min(1),
  timezone_name: z.string().min(1),
  timezone_offset_hours_utc: z.union([z.number(), z.string()]).optional(),
});

function providerErrorCode(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' && Number.isInteger(code) ? code : null;
}

function finiteNonNegativeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseUsageTelemetry(headers: Headers): MetaAdsUsageTelemetry | null {
  const parseObject = (name: string): Record<string, unknown> | null => {
    const header = headers.get(name);
    if (!header) return null;
    try {
      const parsed: unknown = JSON.parse(header);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };
  const adAccount = parseObject('x-ad-account-usage');
  const businessUseCase = parseObject('x-business-use-case-usage');
  const throttle = parseObject('x-fb-ads-insights-throttle');
  const adsInsights = businessUseCase?.ads_insights;
  const businessEntry = Array.isArray(adsInsights) ? adsInsights[0] : null;
  const retryAfter = finiteNonNegativeNumber(headers.get('retry-after'));
  const telemetry = {
    adAccountCallCount: finiteNonNegativeNumber(adAccount?.call_count),
    businessUseCaseCallCount: finiteNonNegativeNumber(
      businessEntry && typeof businessEntry === 'object'
        ? (businessEntry as Record<string, unknown>).call_count
        : null
    ),
    insightsThrottleResetSeconds:
      finiteNonNegativeNumber(throttle?.estimated_time_to_regain_access) ??
      retryAfter,
  };
  return Object.values(telemetry).some((value) => value !== null)
    ? telemetry
    : null;
}

async function fetchMetaJson(
  url: URL,
  accessToken: string,
  failureCode: string,
  fetchImpl: typeof fetch,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  onTelemetry?: (telemetry: MetaAdsUsageTelemetry) => void
): Promise<unknown> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const telemetry = parseUsageTelemetry(response.headers);
    if (telemetry) onTelemetry?.(telemetry);
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // Provider bodies are intentionally discarded.
    }
    if (response.ok) return payload;
    const metaCode = providerErrorCode(payload);
    if (response.status === 401 || metaCode === 190) {
      throw new MetaAdsProviderError(
        'META_ADS_ACCESS_REVOKED',
        response.status
      );
    }
    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      RETRYABLE_META_CODES.has(metaCode ?? -1);
    if (!retryable || attempt === MAX_RETRIES - 1) {
      throw new MetaAdsProviderError(failureCode, response.status);
    }
    const resetHintMs = (telemetry?.insightsThrottleResetSeconds ?? 0) * 1000;
    await sleep(Math.min(60_000, Math.max(250 * 2 ** attempt, resetHintMs)));
  }
  throw new MetaAdsProviderError(failureCode);
}

function parseActions(value: unknown): MetaActionValue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const actionType = (entry as { action_type?: unknown }).action_type;
    const actionValue = (entry as { value?: unknown }).value;
    if (
      typeof actionType !== 'string' ||
      !actionType ||
      typeof actionValue !== 'string' ||
      !DECIMAL.test(actionValue)
    )
      return [];
    return [{ actionType, value: actionValue }];
  });
}

function readNonNegativeInteger(value: unknown): string | null {
  const valueString = typeof value === 'number' ? String(value) : value;
  return typeof valueString === 'string' && INTEGER.test(valueString)
    ? valueString
    : null;
}

export function parseMetaAdsDailyInsights(
  payload: unknown,
  accountId: string
): MetaAdsDailyInsight[] {
  if (
    !/^act_\d+$/.test(accountId) ||
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  )
    return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const spend = row.spend;
    const impressions = readNonNegativeInteger(row.impressions);
    const clicks = readNonNegativeInteger(row.clicks);
    const dateStart = row.date_start;
    const dateStop = row.date_stop;
    if (
      typeof spend !== 'string' ||
      !DECIMAL.test(spend) ||
      !impressions ||
      !clicks ||
      typeof dateStart !== 'string' ||
      !ISO_DATE.test(dateStart) ||
      typeof dateStop !== 'string' ||
      !ISO_DATE.test(dateStop) ||
      dateStart !== dateStop
    )
      return [];
    const providerAccountId =
      typeof row.account_id === 'string' && /^\d+$/.test(row.account_id)
        ? `act_${row.account_id}`
        : accountId;
    if (providerAccountId !== accountId) return [];
    const reach = readNonNegativeInteger(row.reach);
    return [
      {
        accountId,
        actions: parseActions(row.actions),
        actionValues: parseActions(row.action_values),
        attributionSetting:
          typeof row.attribution_setting === 'string'
            ? row.attribution_setting
            : null,
        clicks,
        dateStart,
        dateStop,
        impressions,
        reach,
        spendAmountDecimal: spend,
      },
    ];
  });
}

export async function listMetaAdsAccounts(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
  sleep?: (milliseconds: number) => Promise<void>
): Promise<MetaAdsAccount[]> {
  let next: URL | null = new URL(`${META_ADS_GRAPH_ROOT}/me/adaccounts`);
  next.searchParams.set(
    'fields',
    'id,account_id,name,account_status,currency,timezone_name,timezone_offset_hours_utc'
  );
  next.searchParams.set('limit', '100');
  const accounts = new Map<string, MetaAdsAccount>();
  for (let page = 0; next && page < MAX_ACCOUNT_PAGES; page += 1) {
    const payload = await fetchMetaJson(
      next,
      accessToken,
      'META_ADS_ACCOUNT_DISCOVERY_FAILED',
      fetchImpl,
      sleep
    );
    const record =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as { data?: unknown; paging?: { next?: unknown } })
        : null;
    if (!record || !Array.isArray(record.data))
      throw new MetaAdsProviderError('META_ADS_ACCOUNT_DISCOVERY_INVALID');
    for (const entry of record.data) {
      const parsed = accountSchema.safeParse(entry);
      if (!parsed.success) continue;
      accounts.set(parsed.data.id, {
        accountId: parsed.data.id,
        currencyCode: parsed.data.currency,
        label: parsed.data.name,
        timezoneName: parsed.data.timezone_name,
        timezoneOffsetHours:
          parsed.data.timezone_offset_hours_utc === undefined
            ? null
            : String(parsed.data.timezone_offset_hours_utc),
      });
    }
    const nextValue = record.paging?.next;
    try {
      next = typeof nextValue === 'string' ? new URL(nextValue) : null;
      if (next && next.origin !== 'https://graph.facebook.com')
        throw new Error('unexpected paging origin');
    } catch {
      throw new MetaAdsProviderError('META_ADS_ACCOUNT_PAGING_INVALID');
    }
  }
  if (next) throw new MetaAdsProviderError('META_ADS_ACCOUNT_PAGING_LIMIT');
  return [...accounts.values()];
}

export async function fetchMetaAdsDailyInsights(
  input: {
    accessToken: string;
    accountId: string;
    endDate: string;
    startDate: string;
  },
  fetchImpl: typeof fetch = fetch,
  sleep?: (milliseconds: number) => Promise<void>,
  onTelemetry?: (telemetry: MetaAdsUsageTelemetry) => void
): Promise<MetaAdsDailyInsight[]> {
  if (
    !/^act_\d+$/.test(input.accountId) ||
    !ISO_DATE.test(input.startDate) ||
    !ISO_DATE.test(input.endDate) ||
    input.startDate > input.endDate
  ) {
    throw new MetaAdsProviderError('META_ADS_INSIGHTS_INPUT_INVALID');
  }
  const url = new URL(`${META_ADS_GRAPH_ROOT}/${input.accountId}/insights`);
  url.searchParams.set('level', 'account');
  url.searchParams.set(
    'time_range',
    JSON.stringify({ since: input.startDate, until: input.endDate })
  );
  url.searchParams.set('time_increment', '1');
  url.searchParams.set('limit', '100');
  url.searchParams.set(
    'fields',
    'account_id,account_name,date_start,date_stop,spend,impressions,clicks,reach,actions,action_values,attribution_setting'
  );
  url.searchParams.set('use_unified_attribution_setting', 'true');
  const expectedPath = `/${META_ADS_GRAPH_ROOT.split('/').at(-1)}/${input.accountId}/insights`;
  const insights: MetaAdsDailyInsight[] = [];
  let next: URL | null = url;
  for (let page = 0; next && page < MAX_INSIGHTS_PAGES; page += 1) {
    const payload = await fetchMetaJson(
      next,
      input.accessToken,
      'META_ADS_INSIGHTS_FAILED',
      fetchImpl,
      sleep,
      onTelemetry
    );
    insights.push(...parseMetaAdsDailyInsights(payload, input.accountId));
    const record =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as { paging?: { next?: unknown } })
        : null;
    const nextValue = record?.paging?.next;
    try {
      next = typeof nextValue === 'string' ? new URL(nextValue) : null;
      if (
        next &&
        (next.origin !== 'https://graph.facebook.com' ||
          next.pathname !== expectedPath)
      ) {
        throw new Error('unexpected insights paging URL');
      }
    } catch {
      throw new MetaAdsProviderError('META_ADS_INSIGHTS_PAGING_INVALID');
    }
  }
  if (next) throw new MetaAdsProviderError('META_ADS_INSIGHTS_PAGING_LIMIT');
  return insights;
}

export async function validateMetaAdsGrant(
  input: { accessToken: string; appId: string; appSecret: string },
  fetchImpl: typeof fetch = fetch
): Promise<{ providerUserId: string }> {
  const debugUrl = new URL(`${META_ADS_GRAPH_ROOT}/debug_token`);
  debugUrl.searchParams.set('input_token', input.accessToken);
  debugUrl.searchParams.set(
    'access_token',
    `${input.appId}|${input.appSecret}`
  );
  const debugPayload = await fetchMetaJson(
    debugUrl,
    `${input.appId}|${input.appSecret}`,
    'META_ADS_TOKEN_INVALID',
    fetchImpl
  );
  const data =
    debugPayload &&
    typeof debugPayload === 'object' &&
    !Array.isArray(debugPayload)
      ? (
          debugPayload as {
            data?: {
              app_id?: unknown;
              expires_at?: unknown;
              is_valid?: unknown;
              type?: unknown;
              user_id?: unknown;
            };
          }
        ).data
      : null;
  const expiresAt = finiteNonNegativeNumber(data?.expires_at);
  const providerUserId =
    typeof data?.user_id === 'string' && data.user_id.trim()
      ? data.user_id
      : null;
  if (
    data?.is_valid !== true ||
    String(data.app_id) !== input.appId ||
    String(data.type).toUpperCase() !== 'USER' ||
    !providerUserId ||
    expiresAt === null ||
    expiresAt <= Date.now() / 1000 + 60
  )
    throw new MetaAdsProviderError('META_ADS_TOKEN_INVALID');
  const meUrl = new URL(`${META_ADS_GRAPH_ROOT}/me`);
  meUrl.searchParams.set('fields', 'id');
  const mePayload = await fetchMetaJson(
    meUrl,
    input.accessToken,
    'META_ADS_PROVIDER_IDENTITY_CHECK_FAILED',
    fetchImpl
  );
  const meId =
    mePayload && typeof mePayload === 'object' && !Array.isArray(mePayload)
      ? (mePayload as { id?: unknown }).id
      : null;
  if (typeof meId !== 'string' || meId !== providerUserId)
    throw new MetaAdsProviderError('META_ADS_PROVIDER_IDENTITY_MISMATCH');
  const permissionsUrl = new URL(`${META_ADS_GRAPH_ROOT}/me/permissions`);
  const permissionsPayload = await fetchMetaJson(
    permissionsUrl,
    input.accessToken,
    'META_ADS_PERMISSION_CHECK_FAILED',
    fetchImpl
  );
  const permissions =
    permissionsPayload &&
    typeof permissionsPayload === 'object' &&
    !Array.isArray(permissionsPayload)
      ? (permissionsPayload as { data?: unknown }).data
      : null;
  const hasAdsRead =
    Array.isArray(permissions) &&
    permissions.some(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        (entry as { permission?: unknown }).permission === 'ads_read' &&
        (entry as { status?: unknown }).status === 'granted'
    );
  if (!hasAdsRead)
    throw new MetaAdsProviderError('META_ADS_ADS_READ_NOT_GRANTED');
  return { providerUserId };
}
