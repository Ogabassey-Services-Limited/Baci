import { z } from 'zod';

const blogPostSortColumns = [
  'created_at',
  'updated_at',
  'published_at',
  'title',
  'view_count',
  'reading_time_minutes',
] as const;

const integerQueryParam = (defaultValue: number, min: number, max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === '') return defaultValue;
    return typeof value === 'string' ? Number(value) : value;
  }, z.number().int().min(min).max(max));

export const merchantBlogPostsListQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  limit: integerQueryParam(20, 1, 100),
  offset: integerQueryParam(0, 0, 10_000),
  sortBy: z.enum(blogPostSortColumns).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type MerchantBlogPostsListQuery = z.infer<
  typeof merchantBlogPostsListQuerySchema
>;
