import { z } from 'zod';

const ucpPaginationRequestSchema = z
  .object({
    cursor: z.string().trim().min(1).optional(),
    limit: z
      .number()
      .int()
      .positive()
      .catch(20)
      .transform((value) => Math.min(value, 50))
      .optional()
      .default(20),
  })
  .passthrough();

const ucpSelectedOptionSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1),
    name: z.string().trim().min(1),
  })
  .passthrough();

export const ucpCatalogSearchRequestSchema = z
  .object({
    filters: z.record(z.string(), z.unknown()).optional(),
    pagination: ucpPaginationRequestSchema.optional(),
    query: z.string().trim().min(1).optional(),
  })
  .passthrough()
  .refine(
    (payload) =>
      Boolean(payload.query) ||
      (payload.filters !== undefined &&
        Object.keys(payload.filters).length > 0),
    { message: 'Search requires query or filters' }
  );

export const ucpCatalogLookupRequestSchema = z
  .object({
    filters: z.record(z.string(), z.unknown()).optional(),
    ids: z.array(z.string().trim().min(1)).min(1).max(50),
  })
  .passthrough();

export const ucpCatalogProductRequestSchema = z
  .object({
    filters: z.record(z.string(), z.unknown()).optional(),
    id: z.string().trim().min(1),
    preferences: z.array(z.string().trim().min(1)).optional(),
    selected: z.array(ucpSelectedOptionSchema).optional(),
  })
  .passthrough();

export type UcpCatalogLookupRequest = z.infer<
  typeof ucpCatalogLookupRequestSchema
>;
export type UcpCatalogProductRequest = z.infer<
  typeof ucpCatalogProductRequestSchema
>;
export type UcpCatalogSearchRequest = z.infer<
  typeof ucpCatalogSearchRequestSchema
>;
