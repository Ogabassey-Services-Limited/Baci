import z from 'zod';

export const InviteStaffSchema = z.object({
  email: z.email({ error: 'Invalid email address' }),
  name: z.string(),
  role: z.enum([
    'admin',
    'manager',
    'sales_rep',
    'inventory',
    'accountant',
    'customer_service',
    'marketing',
    'fulfillment',
  ]),
  autoCreateAccount: z.boolean(),
});

export type InviteStaffData = z.infer<typeof InviteStaffSchema>;
