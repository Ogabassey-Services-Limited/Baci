'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import z from 'zod';
import { ensurePermission } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';

// Zod validation schema for discount code
const upsertDiscountCodeSchema = z
  .object({
    id: z.string().optional(),
    code: z.string().min(1, 'Code is required'),
    description: z.string().optional(),
    discount_type: z.enum(['percentage', 'fixed_amount']),
    discount_value: z.number().positive('Discount value must be positive'),
    minimum_purchase_amount: z.number().nonnegative().optional(),
    maximum_discount_amount: z.number().positive().nullable().optional(),
    usage_limit: z.number().positive().nullable().optional(),
    usage_limit_per_customer: z.number().positive().optional(),
    starts_at: z.string().optional(),
    expires_at: z.string().optional(),
    is_active: z.boolean().optional(),
    applies_to: z
      .enum(['all', 'specific_products', 'specific_categories'])
      .optional(),
    product_ids: z.array(z.string()).optional(),
    category_ids: z.array(z.string()).optional(),
  })
  .refine(
    (data) => data.discount_type !== 'percentage' || data.discount_value <= 100,
    { message: 'Percentage discount must be <= 100' }
  );

export interface DiscountCode {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  minimum_purchase_amount: number;
  maximum_discount_amount: number | null;
  usage_limit: number | null;
  usage_count: number;
  usage_limit_per_customer: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  applies_to: 'all' | 'specific_products' | 'specific_categories';
  created_at: string;
}

export type UpsertDiscountCodeInput = {
  id?: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  minimum_purchase_amount?: number;
  maximum_discount_amount?: number | null;
  usage_limit?: number | null;
  usage_limit_per_customer?: number;
  starts_at?: string;
  expires_at?: string;
  is_active?: boolean;
  applies_to?: 'all' | 'specific_products' | 'specific_categories';
  product_ids?: string[];
  category_ids?: string[];
};

export async function getDiscountCodes() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { merchant } = await ensurePermission('marketing', 'view');

  // Get currency symbol
  const { getCountryByCode } = await import('@/lib/countries');
  const country = merchant.country
    ? getCountryByCode(merchant.country)
    : undefined;
  const currencySymbol = country?.currencySymbol || '$';

  // Get discount codes
  const { data: discountCodes, error } = await supabase
    .from('discount_codes')
    // ⚡ Bolt: PERFORMANCE: Explicitly select required columns to prevent overfetching full rows
    .select(
      'id, code, description, discount_type, discount_value, minimum_purchase_amount, maximum_discount_amount, usage_limit, usage_count, usage_limit_per_customer, starts_at, expires_at, is_active, applies_to, created_at, merchant_id'
    )
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return {
    discountCodes: discountCodes as DiscountCode[],
    currencySymbol,
  };
}

export async function upsertDiscountCode(input: UpsertDiscountCodeInput) {
  // Validate input with Zod schema
  const validatedInput = upsertDiscountCodeSchema.parse(input);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const requiredAction = validatedInput.id ? 'edit' : 'create';
  const { merchant } = await ensurePermission('marketing', requiredAction);

  // Base required data
  const baseData = {
    code: validatedInput.code.toUpperCase(),
    discount_type: validatedInput.discount_type,
    discount_value: validatedInput.discount_value,
  };

  // Helper to build payload: undefined inputs are ignored (preserving existing),
  // but explicit values (including nulls if allowed) are applied.
  // For creation, we apply defaults.
  // For update, we only apply what's in validatedInput.

  const buildPayload = (isUpdate: boolean) => {
    const payload: Record<string, unknown> = { ...baseData };

    // Helper to conditionally add field if defined
    const addIfDefined = (
      key: string,
      value: unknown,
      defaultValue?: unknown
    ) => {
      if (value !== undefined) {
        payload[key] = value;
      } else if (!isUpdate && defaultValue !== undefined) {
        // Only apply default on create if missing
        payload[key] = defaultValue;
      }
    };

    // Description: Undefined -> Ignore (Update) or Null (Create). Empty string -> Null.
    if (validatedInput.description !== undefined) {
      payload.description = validatedInput.description || null;
    } else if (!isUpdate) {
      payload.description = null;
    }

    addIfDefined(
      'minimum_purchase_amount',
      validatedInput.minimum_purchase_amount,
      0
    );
    addIfDefined(
      'maximum_discount_amount',
      validatedInput.maximum_discount_amount,
      null
    );
    addIfDefined('usage_limit', validatedInput.usage_limit, null);
    addIfDefined(
      'usage_limit_per_customer',
      validatedInput.usage_limit_per_customer,
      1
    );
    addIfDefined('starts_at', validatedInput.starts_at, null);
    addIfDefined('expires_at', validatedInput.expires_at, null);
    addIfDefined('is_active', validatedInput.is_active, true);
    addIfDefined('applies_to', validatedInput.applies_to, 'all');
    addIfDefined('product_ids', validatedInput.product_ids, []);
    addIfDefined('category_ids', validatedInput.category_ids, []);

    return payload;
  };

  if (validatedInput.id) {
    // Update existing - don't include merchant_id to prevent ownership bypass
    const payload = buildPayload(true);
    const { error } = await supabase
      .from('discount_codes')
      .update(payload)
      .eq('id', validatedInput.id)
      .eq('merchant_id', merchant.id) // Ensure ownership
      // ⚡ Bolt: PERFORMANCE: Explicitly select only the 'id' column instead of the full row to prevent overfetching data during updates
      .select('id')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('Discount code not found');
      }
      if (error.code === '23505') {
        throw new Error('Discount code already exists');
      }
      throw new Error(error.message);
    }
  } else {
    // Create new - include merchant_id for insert
    const payload = buildPayload(false);
    const { error } = await supabase.from('discount_codes').insert({
      ...payload,
      merchant_id: merchant.id,
    });

    if (error) {
      if (error.code === '23505') {
        throw new Error('Discount code already exists');
      }
      throw new Error(error.message);
    }
  }

  revalidatePath('/dashboard/marketing/discount-codes');
  return { success: true };
}

export async function deleteDiscountCode(id: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { merchant } = await ensurePermission('marketing', 'delete');

  const { error } = await supabase
    .from('discount_codes')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchant.id) // Double check ownership
    // ⚡ Bolt: PERFORMANCE: Explicitly select only the 'id' column instead of the full row to prevent overfetching data during deletes
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Discount code not found');
    }
    throw new Error(error.message);
  }

  revalidatePath('/dashboard/marketing/discount-codes');
  return { success: true };
}
