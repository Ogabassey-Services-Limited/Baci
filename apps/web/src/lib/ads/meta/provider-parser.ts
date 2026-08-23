import { z } from 'zod';
import type { MetaActionValue, MetaAdsDailyInsight } from './provider-types';

const DECIMAL = /^\d+(?:\.\d+)?$/;
const INTEGER = /^\d+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface MetaAdsAccount {
  accountId: string;
  currencyCode: string;
  label: string;
  timezoneName: string;
  timezoneOffsetHours: string | null;
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

export function parseMetaAdsAccount(value: unknown): MetaAdsAccount | null {
  const parsed = accountSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    accountId: parsed.data.id,
    currencyCode: parsed.data.currency,
    label: parsed.data.name,
    timezoneName: parsed.data.timezone_name,
    timezoneOffsetHours:
      parsed.data.timezone_offset_hours_utc === undefined
        ? null
        : String(parsed.data.timezone_offset_hours_utc),
  };
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
