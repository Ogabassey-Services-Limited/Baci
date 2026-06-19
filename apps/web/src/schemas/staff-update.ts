import { z } from 'zod';

export const staffRoleSchema = z.enum([
  'admin',
  'manager',
  'sales_rep',
  'inventory',
  'accountant',
  'customer_service',
  'marketing',
  'fulfillment',
  'blog_manager',
]);

export const staffStatusSchema = z.enum([
  'pending',
  'active',
  'suspended',
  'removed',
]);

const staffPermissionActionsSchema = z.record(z.string(), z.boolean());

export const staffUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  role: staffRoleSchema.optional(),
  permissions: z.record(z.string(), staffPermissionActionsSchema).optional(),
  status: staffStatusSchema.optional(),
});

export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
