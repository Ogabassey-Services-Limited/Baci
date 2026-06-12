import { z } from 'zod';

export const fetchMorePostsInputSchema = z.object({
  merchantId: z.uuid(),
  page: z.number().int().min(1).max(200),
  category: z.string().max(100).optional(),
  searchQuery: z.string().max(100).optional(),
});

export type FetchMorePostsInput = z.infer<typeof fetchMorePostsInputSchema>;
