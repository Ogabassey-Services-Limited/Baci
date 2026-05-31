import { z } from 'zod';

const ucpPaginationRequestSchema = z.looseObject({
  cursor: z.string().trim().min(1).optional(),
  limit: z
    .int()
    .positive()
    .catch(20)
    .transform((value) => Math.min(value, 50))
    .optional()
    .prefault(20),
});

const ucpSelectedOptionSchema = z.looseObject({
  id: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

export const ucpCatalogSearchRequestSchema = z
  .looseObject({
    filters: z.record(z.string(), z.unknown()).optional(),
    pagination: ucpPaginationRequestSchema.optional(),
    query: z.string().trim().min(1).optional(),
  })
  .refine(
    (payload) =>
      Boolean(payload.query) ||
      (payload.filters !== undefined &&
        Object.keys(payload.filters).length > 0),
    {
      error: 'Search requires query or filters',
    }
  );

export const ucpCatalogLookupRequestSchema = z.looseObject({
  filters: z.record(z.string(), z.unknown()).optional(),
  ids: z.array(z.string().trim().min(1)).min(1).max(50),
});

export const ucpCatalogProductRequestSchema = z.looseObject({
  filters: z.record(z.string(), z.unknown()).optional(),
  id: z.string().trim().min(1),
  preferences: z.array(z.string().trim().min(1)).optional(),
  selected: z.array(ucpSelectedOptionSchema).optional(),
});

export type UcpCatalogLookupRequest = z.infer<
  typeof ucpCatalogLookupRequestSchema
>;
export type UcpCatalogProductRequest = z.infer<
  typeof ucpCatalogProductRequestSchema
>;
export type UcpCatalogSearchRequest = z.infer<
  typeof ucpCatalogSearchRequestSchema
>;
