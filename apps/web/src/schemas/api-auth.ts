import { z } from 'zod';

export const userAccessSchema = z.object({
  merchant_id: z.string().uuid(),
  role: z.string().min(1),
  is_owner: z.boolean(),
  is_staff: z.boolean(),
  permissions: z
    .record(z.string(), z.record(z.string(), z.boolean()))
    .optional(),
});

export type UserAccess = z.infer<typeof userAccessSchema>;
