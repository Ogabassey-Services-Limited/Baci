import type { AdminMerchantHealthRow } from '@/types/admin-merchants';

export type HealthFilter = 'all' | AdminMerchantHealthRow['health_status'];

export const HEALTH_FILTER_OPTIONS = [
  'all',
  'healthy',
  'at_risk',
  'churned',
  'new',
] as const satisfies readonly HealthFilter[];

const HEALTH_FILTERS = new Set<HealthFilter>(HEALTH_FILTER_OPTIONS);

export function isHealthFilter(value: string): value is HealthFilter {
  return HEALTH_FILTERS.has(value as HealthFilter);
}
