import { z } from 'zod';

export const heroCarouselSlideSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  imageUrl: z.string().trim().max(2048).optional().default(''),
  headline: z.string().trim().max(120).optional().default(''),
  description: z.string().trim().max(280).optional().default(''),
  cta: z.string().trim().max(60).optional().default(''),
  link: z.string().trim().max(2048).optional().default('/category/all'),
});

export const heroCarouselUpdateRequestSchema = z.object({
  slides: z.array(heroCarouselSlideSchema).max(12),
});

export type HeroCarouselSlideInput = z.infer<typeof heroCarouselSlideSchema>;
export type HeroCarouselUpdateRequest = z.infer<
  typeof heroCarouselUpdateRequestSchema
>;
