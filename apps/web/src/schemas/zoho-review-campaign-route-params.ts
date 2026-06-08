import { z } from 'zod';

export const zohoReviewCampaignRouteParamsSchema = z.object({
  id: z.uuid('Invalid blog post id'),
});
