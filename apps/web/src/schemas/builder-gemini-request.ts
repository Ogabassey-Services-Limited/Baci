import { z } from 'zod';
import { aiBuilderConfigSchema } from '@/app/api/builder/gemini/builder-config-shape';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';

export const builderGeminiRequestSchema = z.object({
  merchantId: merchantIdParamSchema,
  prompt: z.string().trim().min(1, 'Prompt is required'),
  currentConfig: aiBuilderConfigSchema,
});
