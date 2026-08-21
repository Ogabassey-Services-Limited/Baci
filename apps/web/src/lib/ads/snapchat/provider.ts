import 'server-only';

import { SNAPCHAT_ADS_API_ROOT } from './constants';
import { requestSnapchatAdsJson, SnapchatAdsProviderError } from './request';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const INTEGER = /^\d+$/;

export { SnapchatAdsProviderError } from './request';
export interface SnapchatAdsAccount {
  accountId: string;
  currencyCode: string;
  label: string;
  organizationId: string;
  timezoneName: string;
}
export interface SnapchatAdsDailyReport {
  accountId: string;
  clicks: string;
  conversions: string;
  currencyCode: string;
  impressions: string;
  spendAmountDecimal: string;
  spendDate: string;
  spendMicros: string;
  sourceEndTime: string;
  sourceStartTime: string;
  conversionDataProcessedEndTime: string | null;
  finalizedDataEndTime: string | null;
  timezoneName: string;
}
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}
function objectArray(value: unknown): RecordValue[] {
  if (!Array.isArray(value)) return [];
  return value.reduce<RecordValue[]>((items, item) => {
    const itemRecord = record(item);
    if (itemRecord) items.push(itemRecord);
    return items;
  }, []);
}
function nested(value: RecordValue, name: string): RecordValue {
  return record(value[name]) ?? value;
}
function integer(value: unknown): string | null {
  const stringValue = typeof value === 'string' ? value : null;
  return stringValue && INTEGER.test(stringValue) ? stringValue : null;
}
function decimal(value: unknown): string | null {
  const stringValue = typeof value === 'string' ? value : null;
  return stringValue && /^\d+(?:\.\d+)?$/.test(stringValue)
    ? stringValue
    : null;
}
function isTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
export function snapchatAdsLocalDate(epoch: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(new Date(epoch));
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}
function timezoneOffset(epoch: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(new Date(epoch));
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return (
    Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour) % 24,
      Number(values.minute),
      Number(values.second)
    ) - epoch
  );
}
export function snapchatAdsLocalMidnight(
  date: string,
  timezone: string
): string {
  if (!ISO_DATE.test(date) || !isTimezone(timezone))
    throw new SnapchatAdsProviderError('SNAPCHAT_ADS_TIMEZONE_INVALID');
  const guess = Date.parse(`${date}T00:00:00.000Z`);
  let epoch = guess - timezoneOffset(guess, timezone);
  epoch = guess - timezoneOffset(epoch, timezone);
  return new Date(epoch).toISOString();
}
function microToDecimal(micros: string): string {
  const amount = BigInt(micros);
  const whole = amount / 1_000_000n;
  const fraction = (amount % 1_000_000n)
    .toString()
    .padStart(6, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
function accountFrom(
  value: RecordValue,
  organizationId: string
): SnapchatAdsAccount | null {
  const account = nested(value, 'ad_account');
  const id = account.id;
  const label = account.name;
  const currency = account.currency;
  const timezone = account.timezone;
  const status =
    typeof account.status === 'string' ? account.status.toUpperCase() : '';
  if (
    typeof id !== 'string' ||
    !id ||
    typeof label !== 'string' ||
    !label ||
    typeof currency !== 'string' ||
    !/^[A-Z]{3}$/.test(currency) ||
    typeof timezone !== 'string' ||
    !isTimezone(timezone) ||
    status !== 'ACTIVE'
  )
    return null;
  return {
    accountId: id,
    currencyCode: currency,
    label,
    organizationId,
    timezoneName: timezone,
  };
}
export async function listSnapchatAdsAccounts(
  input: { accessToken: string },
  fetchImpl: typeof fetch = fetch
): Promise<SnapchatAdsAccount[]> {
  const url = new URL(`${SNAPCHAT_ADS_API_ROOT}/me/organizations`);
  url.searchParams.set('with_ad_accounts', 'true');
  const payload = await requestSnapchatAdsJson(
    url,
    { headers: { Authorization: `Bearer ${input.accessToken}` } },
    'SNAPCHAT_ADS_ACCOUNT_DISCOVERY_FAILED',
    fetchImpl
  );
  const root = record(payload);
  const organizations = objectArray(root?.organizations ?? root?.data);
  if (
    !root ||
    (!organizations.length && !Array.isArray(root.organizations ?? root.data))
  )
    throw new SnapchatAdsProviderError(
      'SNAPCHAT_ADS_ACCOUNT_DISCOVERY_INVALID'
    );
  const accounts = organizations.flatMap((entry) => {
    const organization = nested(entry, 'organization');
    const organizationId = organization.id;
    if (typeof organizationId !== 'string' || !organizationId) return [];
    return objectArray(
      organization.ad_accounts ?? organization.adaccounts
    ).flatMap((item) => {
      const account = accountFrom(item, organizationId);
      return account ? [account] : [];
    });
  });
  return [
    ...new Map(
      accounts.map((account) => [account.accountId, account])
    ).values(),
  ];
}
function statsList(payload: unknown): RecordValue[] {
  const root = record(payload);
  if (!root) return [];
  return objectArray(
    root.timeseries_stats ??
      root.timeseries ??
      record(root.data)?.timeseries_stats
  );
}
function isoTimestamp(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : null;
}
function parseReports(
  payload: unknown,
  input: { accountId: string; currencyCode: string; timezoneName: string }
): SnapchatAdsDailyReport[] {
  const rows = statsList(payload);
  const root = record(payload);
  const finalizedDataEndTime = isoTimestamp(root?.finalized_data_end_time);
  const conversionDataProcessedEndTime = isoTimestamp(
    root?.conversion_data_processed_end_time
  );
  if (!rows.length && !record(payload))
    throw new SnapchatAdsProviderError('SNAPCHAT_ADS_REPORT_RESPONSE_INVALID');
  const parsed = rows.flatMap((row) => {
    const stats = record(row.stats);
    const start = row.start_time;
    const end = row.end_time;
    const micros = integer(stats?.spend);
    const impressions = integer(stats?.impressions);
    const swipes = integer(stats?.swipes);
    const purchases = decimal(stats?.conversion_purchases);
    if (
      typeof start !== 'string' ||
      typeof end !== 'string' ||
      !micros ||
      !impressions ||
      !swipes ||
      !purchases
    )
      return [];
    const timestamp = Date.parse(start);
    if (!Number.isFinite(timestamp) || !Number.isFinite(Date.parse(end)))
      return [];
    return [
      {
        accountId: input.accountId,
        clicks: swipes,
        conversions: purchases,
        currencyCode: input.currencyCode,
        impressions,
        spendAmountDecimal: microToDecimal(micros),
        spendDate: snapchatAdsLocalDate(timestamp, input.timezoneName),
        spendMicros: micros,
        sourceEndTime: end,
        sourceStartTime: start,
        conversionDataProcessedEndTime,
        finalizedDataEndTime,
        timezoneName: input.timezoneName,
      },
    ];
  });
  if (rows.length !== parsed.length)
    throw new SnapchatAdsProviderError('SNAPCHAT_ADS_REPORT_ROWS_INVALID');
  return parsed;
}
export async function fetchSnapchatAdsDailyReport(
  input: {
    accessToken: string;
    accountId: string;
    currencyCode: string;
    endDate: string;
    startDate: string;
    timezoneName: string;
  },
  fetchImpl: typeof fetch = fetch
): Promise<SnapchatAdsDailyReport[]> {
  if (
    !input.accountId ||
    !ISO_DATE.test(input.startDate) ||
    !ISO_DATE.test(input.endDate) ||
    input.startDate > input.endDate ||
    !isTimezone(input.timezoneName)
  )
    throw new SnapchatAdsProviderError('SNAPCHAT_ADS_REPORT_INPUT_INVALID');
  const url = new URL(
    `${SNAPCHAT_ADS_API_ROOT}/adaccounts/${encodeURIComponent(input.accountId)}/stats`
  );
  url.searchParams.set(
    'end_time',
    snapchatAdsLocalMidnight(nextDate(input.endDate), input.timezoneName)
  );
  url.searchParams.set(
    'fields',
    'impressions,spend,swipes,conversion_purchases'
  );
  url.searchParams.set('granularity', 'DAY');
  url.searchParams.set('omit_empty', 'false');
  url.searchParams.set(
    'start_time',
    snapchatAdsLocalMidnight(input.startDate, input.timezoneName)
  );
  url.searchParams.set('action_report_time', 'conversion');
  url.searchParams.set('swipe_up_attribution_window', '28_DAY');
  url.searchParams.set('view_attribution_window', '1_DAY');
  const payload = await requestSnapchatAdsJson(
    url,
    { headers: { Authorization: `Bearer ${input.accessToken}` } },
    'SNAPCHAT_ADS_REPORT_FAILED',
    fetchImpl
  );
  const root = record(payload);
  const reportRunId = root?.report_run_id;
  if (typeof reportRunId === 'string' && reportRunId)
    throw new SnapchatAdsProviderError('SNAPCHAT_ADS_ASYNC_REPORT_UNSUPPORTED');
  return parseReports(payload, input);
}
function nextDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
