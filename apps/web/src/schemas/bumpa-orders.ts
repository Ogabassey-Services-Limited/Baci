import { z } from 'zod';

export const bumpaOrderRowSchema = z
  .object({
    id: z.string().trim().min(1, 'id is missing'),
    'Order Number': z.string().trim().min(1, 'Order Number is missing'),
    Products: z.string().trim().min(1, 'Products is missing'),
    'Customer Name': z.string().trim().optional().default(''),
    'Customer Email': z.string().trim().optional().default(''),
    'Customer Phone': z.string().trim().optional().default(''),
    'Payment Status': z.string().trim().min(1, 'Payment Status is missing'),
    Status: z.string().trim().min(1, 'Status is missing'),
    'Shipping Status': z.string().trim().optional().default(''),
    Channel: z.string().trim().optional().default(''),
    Origin: z.string().trim().optional().default(''),
    Total: z.string().trim().min(1, 'Total is missing'),
    'Sub Total': z.string().trim().min(1, 'Sub Total is missing'),
    Discount: z.string().trim().optional().default('0'),
    'Amount Paid': z.string().trim().optional().default('0'),
    'Amount Due': z.string().trim().optional().default('0'),
    'Order Date': z.string().trim().min(1, 'Order Date is missing'),
    'Created At': z.string().trim().min(1, 'Created At is missing'),
    'Updated At': z.string().trim().optional().default(''),
    'Shipping Price': z.string().trim().optional().default('0'),
    Tax: z.string().trim().optional().default('0'),
    'Coupon Code': z.string().trim().optional().default(''),
    'Shipping Option': z.string().trim().optional().default(''),
    'Product SKU': z.string().trim().optional().default(''),
    'Product Quantity': z.string().trim().min(1, 'Product quantity is missing'),
    items_json: z
      .string()
      .trim()
      .optional()
      .default('')
      .refine((value) => {
        if (!value) return true;

        try {
          const parsed: unknown = JSON.parse(value);
          return (
            Array.isArray(parsed) &&
            parsed.every(
              (item) =>
                Boolean(item) &&
                typeof item === 'object' &&
                !Array.isArray(item)
            )
          );
        } catch {
          return false;
        }
      }, 'items_json must be a JSON array of objects'),
  })
  .superRefine((row, ctx) => {
    const hasCustomerName = row['Customer Name'].length > 0;
    const hasCustomerEmail = row['Customer Email'].length > 0;
    const hasCustomerPhone = row['Customer Phone'].length > 0;

    if (!hasCustomerName && !hasCustomerEmail && !hasCustomerPhone) {
      ctx.addIssue({
        code: 'custom',
        path: ['Customer Name'],
        message: 'Customer name, email, or phone is required',
      });
    }
  });

export type BumpaOrderRow = z.infer<typeof bumpaOrderRowSchema>;
