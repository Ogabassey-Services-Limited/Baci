import { z } from 'zod';

export interface KudaBillItemPayload {
  itemCode: string;
  itemName: string;
  amount: number;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
  billItems?: KudaBillItemPayload[];
}

export const kudaBillItemSchema: z.ZodType<KudaBillItemPayload> = z.lazy(() =>
  z.object({
    itemCode: z.string(),
    itemName: z.string(),
    amount: z.number().nonnegative(),
    itemCurrencySymbol: z.string(),
    isAmountFixed: z.boolean(),
    itemFee: z.number().nonnegative(),
    billItems: z.array(kudaBillItemSchema).optional(),
  })
);

export const kudaBillerSchema = z.object({
  billerId: z.string(),
  billerName: z.string(),
  billerType: z.string(),
  categoryId: z.string(),
  categoryName: z.string(),
  billerIconUrl: z.string().optional(),
  billItems: z.array(kudaBillItemSchema).optional(),
});

export const monnifySupportedCategorySchema = z.enum([
  'airtime',
  'electricity',
  'cable_tv',
]);

export type MonnifySupportedCategory = z.infer<
  typeof monnifySupportedCategorySchema
>;
