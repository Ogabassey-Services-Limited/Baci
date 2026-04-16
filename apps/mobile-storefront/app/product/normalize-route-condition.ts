import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import type { ProductCondition } from '@/types/product';

export function normalizeRouteCondition(
  value: string | string[] | null | undefined
): ProductCondition | null {
  const normalized = normalizeCanonicalProductCondition(
    typeof value === 'string' ? value : null
  );
  return normalized || null;
}
