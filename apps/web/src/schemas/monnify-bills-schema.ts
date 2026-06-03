import { z } from 'zod';

export const validateCustomerRequestSchema = z.object({
  billerCode: z.string().min(1, 'Biller code is required'),
  productCode: z.string().min(1, 'Product code is required'),
  customerId: z.string().min(1, 'Customer identifier is required'),
});

export type ValidateCustomerRequest = z.infer<
  typeof validateCustomerRequestSchema
>;

export const vendRequestSchema = z.object({
  productCode: z.string().min(1, 'Product code is required'),
  vendAmount: z.number().positive('Vend amount must be positive'),
  customerId: z.string().min(1, 'Customer identifier is required'),
  vendReference: z.string().min(1, 'Vend reference is required'),
  validationReference: z.string().optional(),
});

export type VendRequest = z.infer<typeof vendRequestSchema>;
