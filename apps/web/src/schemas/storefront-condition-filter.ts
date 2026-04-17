import { normalizeCanonicalProductCondition } from '@baci/shared/lib';
import { z } from 'zod';

export const storefrontConditionFilterSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    if (value === 'all') {
      return value;
    }

    return normalizeCanonicalProductCondition(value) || value;
  },
  z.enum(['new', 'used', 'open_box', 'all'])
);
