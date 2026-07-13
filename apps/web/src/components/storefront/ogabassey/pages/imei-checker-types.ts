import type { ImeiServiceTierKey } from '@baci/shared/imei';

export interface ImeiRequestIdentity {
  imei: string;
  tier: ImeiServiceTierKey;
  key: string;
}

// Re-exported (not duplicated) from the API route's own result type so the
// two can never drift — the route already returns this exact shape.
export type { ImeiCheckResult as ImeiResult } from '@/app/api/storefront/imei-check/sickw-parser.types';

export interface ProductSuggestion {
  id: string;
  name: string;
  category?: string;
  image?: string;
}
