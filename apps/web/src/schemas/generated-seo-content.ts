import { z } from 'zod';

const generatedSEOTextSchema = z.string().trim().min(1).max(500);

export const generatedSEOContentSchema = z.object({
  meta_title: generatedSEOTextSchema.max(70),
  meta_description: generatedSEOTextSchema.max(160),
  keywords: z.array(generatedSEOTextSchema.max(100)).min(1).max(20),
  focus_keyword: generatedSEOTextSchema.max(100),
  suggestions: z.array(generatedSEOTextSchema).max(20).optional(),
});
