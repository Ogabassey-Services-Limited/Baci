
import { z } from 'zod';

export const merchantSchema = z.object({
  businessName: z.string(),
  businessType: z.string(),
  logo: z.string().optional(),
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
  }),
});

export type Merchant = z.infer<typeof merchantSchema>;
