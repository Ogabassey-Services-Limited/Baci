import { z } from 'zod';

const permissionActionsSchema = z.record(z.string(), z.boolean());

export const dashboardMerchantContextSchema = z.object({
  merchant: z.record(z.string(), z.unknown()).nullable(),
  primaryDomain: z
    .object({
      domain: z.string().min(1),
    })
    .passthrough()
    .nullable(),
  staffAccess: z.object({
    isStaff: z.boolean(),
    isOwner: z.boolean(),
    role: z.string().nullable(),
    permissions: z.record(z.string(), permissionActionsSchema),
  }),
});
