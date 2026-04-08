import { z } from 'zod';

export interface BillItem {
  itemCode: string;
  itemName: string;
  amount: number;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
  billItems?: BillItem[];
}

export const BillItemSchema: z.ZodType<BillItem> = z.lazy(() =>
  z.object({
    itemCode: z.string().describe('Unique identifier for a bill item'),
    itemName: z.string().describe('Display label for the bill item'),
    amount: z
      .number()
      .nonnegative()
      .describe('Configured amount when fixed by provider'),
    itemCurrencySymbol: z
      .string()
      .describe('Currency symbol returned by the provider'),
    isAmountFixed: z
      .boolean()
      .describe('Whether the provider fixes the amount for this bill item'),
    itemFee: z
      .number()
      .nonnegative()
      .describe('Provider fee attached to the bill item'),
    billItems: z
      .array(BillItemSchema)
      .optional()
      .describe('Nested bill items for providers with multi-step selection'),
  })
);

/**
 * VTU Biller Schema - 2026 Best Practice
 * Ensures runtime integrity of biller data from external APIs.
 */
export const BillerSchema = z.object({
  billerId: z.string().describe('Unique identifier for the biller/provider'),
  billerName: z.string().describe('Display name of the biller'),
  billerType: z.string().describe('Type/description of the biller'),
  categoryId: z.string().describe('Category ID from the Kuda API'),
  categoryName: z.string().describe('Display name of the category'),
  billerIconUrl: z.string().optional().describe('Icon URL for the biller'),
  billItems: z
    .array(BillItemSchema)
    .optional()
    .describe('Optional bill item submenu for providers like prepaid/postpaid'),
});

/**
 * VTU Biller List Response Schema
 */
export const BillerListSchema = z.object({
  billers: z.array(BillerSchema),
});

export type Biller = z.infer<typeof BillerSchema>;
export type BillerListResponse = z.infer<typeof BillerListSchema>;
