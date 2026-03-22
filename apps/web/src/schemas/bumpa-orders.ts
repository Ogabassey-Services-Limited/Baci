import { z } from 'zod';

export const bumpaOrderRowSchema = z.object({
  id: z.string().trim().min(1),
  'Order Number': z.string().trim().min(1),
  Products: z.string().trim().min(1),
  'Customer Name': z.string().trim().min(1),
  'Customer Email': z.string().trim().optional().default(''),
  'Customer Phone': z.string().trim().optional().default(''),
  'Payment Status': z.string().trim().min(1),
  Status: z.string().trim().min(1),
  'Shipping Status': z.string().trim().optional().default(''),
  Channel: z.string().trim().optional().default(''),
  Origin: z.string().trim().optional().default(''),
  Total: z.string().trim().min(1),
  'Sub Total': z.string().trim().min(1),
  Discount: z.string().trim().optional().default('0'),
  'Amount Paid': z.string().trim().optional().default('0'),
  'Amount Due': z.string().trim().optional().default('0'),
  'Order Date': z.string().trim().min(1),
  'Created At': z.string().trim().min(1),
  'Updated At': z.string().trim().optional().default(''),
  'Shipping Price': z.string().trim().optional().default('0'),
  Tax: z.string().trim().optional().default('0'),
  'Coupon Code': z.string().trim().optional().default(''),
  'Shipping Option': z.string().trim().optional().default(''),
  'Product SKU': z.string().trim().optional().default(''),
  'Product Quantity': z.string().trim().min(1),
});

export type BumpaOrderRow = z.infer<typeof bumpaOrderRowSchema>;
