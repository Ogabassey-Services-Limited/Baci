import { z } from 'zod';

export const userAccessSchema = z.object({
  merchant_id: z.string().uuid(),
  role: z.enum(['owner', 'admin', 'manager', 'staff']),
  is_owner: z.boolean(),
  is_staff: z.boolean(),
  permissions: z.record(z.record(z.boolean())).optional(),
});

export type UserAccess = z.infer<typeof userAccessSchema>;
