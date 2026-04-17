import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import { z } from 'zod';

export const storefrontConditionFilterSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === 'all') {
      return 'all';
    }

    return normalizeCanonicalProductCondition(value) || value;
  },
  z.enum(['new', 'used', 'open_box', 'all'])
);
