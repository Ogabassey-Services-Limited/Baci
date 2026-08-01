import { z } from 'zod';
import { merchantIdParamSchema } from './merchant-id-param';

export const archiveProductRequestSchema = z.object({
  merchantId: merchantIdParamSchema,
});
