import { z } from 'zod';

export const adminGenerateHeroImageCategorySchema = z.enum([
  'fashion',
  'electronics',
  'hair-extensions',
  'home-goods',
  'health-beauty',
  'handmade',
  'food-beverage',
  'other',
]);

export const adminGenerateHeroImagesRequestSchema = z.object({
  category: adminGenerateHeroImageCategorySchema,
  count: z.number().int().min(1).max(20).optional().default(10),
});
