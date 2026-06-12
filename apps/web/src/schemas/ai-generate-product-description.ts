import { z } from 'zod';

export const generateProductDescriptionInputSchema = z.object({
  productName: z.string().min(1).max(200),
  keywords: z.array(z.string().max(50)).max(10).optional(),
  brandVoice: z.string().max(200).optional(),
  targetAudience: z.string().max(200).optional(),
  businessType: z.string().max(100).optional(),
});

export type GenerateProductDescriptionInput = z.infer<
  typeof generateProductDescriptionInputSchema
>;
