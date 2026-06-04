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

// Generic Monnify API Envelope Schema
export function monnifyEnvelopeSchema<T extends z.ZodTypeAny>(bodySchema: T) {
  return z.object({
    requestSuccessful: z.boolean(),
    responseCode: z.string(),
    responseMessage: z.string(),
    responseBody: bodySchema.optional().nullable(),
  });
}

// Biller Category Schema
export const billerCategorySchema = z.object({
  name: z.string(),
  description: z.string(),
  code: z.string(),
});
export type BillerCategory = z.infer<typeof billerCategorySchema>;

// Biller Schema
export const billerSchema = z.object({
  name: z.string(),
  description: z.string(),
  billerCode: z.string(),
  billerCategoryCode: z.string(),
});
export type Biller = z.infer<typeof billerSchema>;

// Biller Product Schema
export const billerProductSchema = z.object({
  productCode: z.string(),
  name: z.string(),
  billerCode: z.string(),
  fee: z.number().catch(0).optional().nullable(),
  amount: z.number().catch(0).optional().nullable(),
  isAmountFixed: z.boolean().catch(false).optional().nullable(),
});
export type BillerProduct = z.infer<typeof billerProductSchema>;

// Validate Customer Response Body Schema (flat + nested vendInstruction support)
export const validateCustomerResponseBodySchema = z.object({
  customerName: z.string().optional().nullable(),
  validationReference: z.string().optional().nullable(),
  requireValidationRef: z.boolean().optional().nullable(),
  vendInstruction: z
    .object({
      validationReference: z.string().optional().nullable(),
      requireValidationRef: z.boolean().optional().nullable(),
    })
    .optional()
    .nullable(),
});
export type ValidateCustomerResponseBody = z.infer<
  typeof validateCustomerResponseBodySchema
>;

// Vend Response Body Schema
export const vendResponseBodySchema = z.object({
  transactionReference: z.string().optional().nullable(),
  paymentReference: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  vendStatus: z.string().optional().nullable(),
  token: z.string().optional().nullable(),
});
export type VendResponseBody = z.infer<typeof vendResponseBodySchema>;

// Requery Response Body Schema
export const requeryResponseBodySchema = z.object({
  transactionReference: z.string().optional().nullable(),
  paymentReference: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  vendStatus: z.string().optional().nullable(),
  token: z.string().optional().nullable(),
});
export type RequeryResponseBody = z.infer<typeof requeryResponseBodySchema>;
