import { STORE_READINESS_SURFACES } from '@baci/shared';
import { z } from 'zod';
import { merchantIdParamSchema } from '@/schemas/merchant-id-param';

export const storeReadinessQuerySchema = z.object({
  merchantId: merchantIdParamSchema.optional(),
  surface: z.enum(STORE_READINESS_SURFACES).default('web'),
});
