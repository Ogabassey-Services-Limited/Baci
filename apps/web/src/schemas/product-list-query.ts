import { z } from 'zod';
import {
  migrationFilterValues,
  statusFilterValues,
  stockFilterValues,
} from '@/lib/product-list-filters';

const stringParamSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}, z.string().optional());

const MAX_PAGE = 10_000;
const MAX_LIMIT = 100;

function normalizeStatusFilterParam(value: string | undefined) {
  if (!value) {
    return 'All';
  }

  return value === 'published' ? 'active' : value;
}

const positiveIntegerSchema = (defaultValue: number, maxValue: number) =>
  z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value[0];
    }

    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return Number(value);
    }

    return value;
  }, z.number().int().positive().max(maxValue));

export const productListQuerySchema = z.object({
  page: positiveIntegerSchema(1, MAX_PAGE),
  limit: positiveIntegerSchema(10, MAX_LIMIT),
  search: stringParamSchema.transform((value) => value ?? ''),
  ids: stringParamSchema,
  migration: stringParamSchema
    .transform((value) => value ?? 'All')
    .pipe(z.enum(migrationFilterValues)),
  status: stringParamSchema
    .transform(normalizeStatusFilterParam)
    .pipe(z.enum(statusFilterValues)),
  stock: stringParamSchema
    .transform((value) => value ?? 'All')
    .pipe(z.enum(stockFilterValues)),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
