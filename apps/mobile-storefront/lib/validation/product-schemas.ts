import { z } from 'zod';

export const MerchantRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().optional(),
  name: z.string().optional(),
});

export type MerchantRow = z.infer<typeof MerchantRowSchema>;

export const CustomerRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  loyalty_points: z.number().nullable().optional(),
});

export type CustomerRow = z.infer<typeof CustomerRowSchema>;

export const OrderRowSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string().nullable().optional(),
  total: z.number().optional(),
  payment_status: z.string().optional(),
  shipping_status: z.string().optional(),
  tracking_number: z.string().nullable().optional(),
  shipping_provider: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type OrderRow = z.infer<typeof OrderRowSchema>;

const VariantAttributeEntrySchema = z.object({
  param: z.string(),
  options: z.array(z.string()),
});

const ProductVariantSchema = z.object({
  id: z.string(),
  product_id: z.string().optional(),
  merchant_id: z.string().optional(),
  name: z.string().optional(),
  sku: z.string().nullable().optional(),
  price: z.number().optional(),
  compare_at_price: z.number().nullable().optional(),
  price_override: z.number().nullable().optional(),
  price_modifier: z.number().nullable().optional(),
  image: z.string().nullable().optional(),
  primary_image: z.string().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  in_stock: z.boolean().nullable().optional(),
  stock_quantity: z.number().nullable().optional(),
  attributes: z.record(z.string(), z.string()).nullable().optional(),
});

const ProductColorSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    value: z.string().optional(),
  }),
]);

const ProductConditionOfferSchema = z.object({
  id: z.string(),
  condition: z.string(),
  price: z.number(),
  compare_at_price: z.number().nullable().optional(),
  stock_quantity: z.number().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  condition_notes: z.string().nullable().optional(),
  grade: z.enum(['A', 'B', 'C', 'D']).nullable().optional(),
});

const VariantAttributeRecordSchema = z.record(
  z.string(),
  z.union([z.array(z.string()), z.string(), z.null()])
);

export const ProductRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  price: z.number(),
  compare_at_price: z.number().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  brand: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  condition: z.string().nullable().optional(),
  average_rating: z.number().nullable().optional(),
  review_count: z.number().int().nonnegative().nullable().optional(),
  manage_stock: z.boolean().nullable().optional(),
  stock: z.number().nullable().optional(),
  stock_quantity: z.number().nullable().optional(),
  status: z.string().optional(),
  specifications: z.record(z.string(), z.string()).nullable().optional(),
  has_variants: z.boolean().nullable().optional(),
  variant_attributes: z
    .union([z.array(VariantAttributeEntrySchema), VariantAttributeRecordSchema])
    .nullable()
    .optional(),
  variants: z.array(ProductVariantSchema).nullable().optional(),
  colors: z.array(ProductColorSchema).nullable().optional(),
  color_images: z
    .record(z.string(), z.array(z.string()).nullable().optional())
    .nullable()
    .optional(),
  has_condition_offers: z.boolean().nullable().optional(),
  offers: z.array(ProductConditionOfferSchema).nullable().optional(),
  categories: z
    .union([
      z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
        })
      ),
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
      }),
    ])
    .nullable()
    .optional(),
});

export type ProductRow = z.infer<typeof ProductRowSchema>;

export const WalletRowSchema = z.object({
  id: z.string().uuid(),
  available_balance: z.number().default(0),
});

export type WalletRow = z.infer<typeof WalletRowSchema>;

export const TransactionRowSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['credit', 'debit']),
  amount: z.number(),
  description: z.string().nullable().optional(),
  created_at: z.string(),
});

export type TransactionRow = z.infer<typeof TransactionRowSchema>;

export function isOrderRealtimePayload(
  payload: unknown
): payload is { new: OrderRow; old?: OrderRow | null } {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (!('new' in p) || typeof p.new !== 'object' || p.new === null)
    return false;
  const newResult = OrderRowSchema.safeParse(p.new);
  if (!newResult.success) return false;
  if (!('old' in p) || p.old == null) return true;
  return OrderRowSchema.safeParse(p.old).success;
}

export function isWalletRealtimePayload(
  payload: unknown
): payload is { new: WalletRow; old?: WalletRow | null } {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (!('new' in p) || typeof p.new !== 'object' || p.new === null)
    return false;
  const newResult = WalletRowSchema.safeParse(p.new);
  if (!newResult.success) return false;
  if (!('old' in p) || p.old == null) return true;
  return WalletRowSchema.safeParse(p.old).success;
}

export function isCustomerRealtimePayload(
  payload: unknown
): payload is { new: CustomerRow; old?: CustomerRow | null } {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  if (!('new' in p) || typeof p.new !== 'object' || p.new === null)
    return false;
  const newResult = CustomerRowSchema.safeParse(p.new);
  if (!newResult.success) return false;
  if (!('old' in p) || p.old == null) return true;
  return CustomerRowSchema.safeParse(p.old).success;
}

export function parseApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(
      'API response validation failed',
      context ? `(${context})` : '',
      result.error.issues.map((issue) => JSON.stringify(issue))
    );
    return null;
  }
  return result.data;
}
