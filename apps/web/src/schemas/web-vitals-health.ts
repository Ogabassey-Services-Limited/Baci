import { z } from 'zod';

/**
 * Shape of a PostHog HogQL query response (`POST /api/projects/{id}/query/`).
 * Only the fields the web-vitals health cron reads are validated; the query
 * SELECTs a single aggregate row, so `results[0]` holds the counts in the order
 * declared by `WEB_VITALS_HEALTH_QUERY`. Cells arrive as numbers, numeric
 * strings, or null (empty windows), so each is coerced to a finite number.
 */
const hogqlCellSchema = z.union([z.number(), z.string(), z.null()]);

export const postHogWebVitalsQueryResponseSchema = z.object({
  results: z.array(z.array(hogqlCellSchema)),
  columns: z.array(z.string()).optional(),
});

export type PostHogWebVitalsQueryResponse = z.infer<
  typeof postHogWebVitalsQueryResponseSchema
>;
