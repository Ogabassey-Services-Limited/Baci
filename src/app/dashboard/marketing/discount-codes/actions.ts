'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get merchant
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (merchantError || !merchant) {
    throw new Error('Merchant not found');
  }

  // Get discount codes
  const { data: discountCodes, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return discountCodes as DiscountCode[];
}

export async function upsertDiscountCode(input: UpsertDiscountCodeInput) {
  // Validate input with Zod schema
  const validatedInput = upsertDiscountCodeSchema.parse(input);

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get merchant
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (merchantError || !merchant) {
    throw new Error('Merchant not found');
  }

  // Base data without merchant_id (to prevent ownership bypass on update)
  const baseDiscountCodeData = {
    code: validatedInput.code.toUpperCase(),
    description: validatedInput.description || null,
    discount_type: validatedInput.discount_type,
    discount_value: validatedInput.discount_value,
    minimum_purchase_amount: validatedInput.minimum_purchase_amount || 0,
    maximum_discount_amount: validatedInput.maximum_discount_amount || null,
    usage_limit: validatedInput.usage_limit || null,
    usage_limit_per_customer: validatedInput.usage_limit_per_customer || 1,
    starts_at: validatedInput.starts_at || null,
    expires_at: validatedInput.expires_at || null,
    is_active:
      validatedInput.is_active !== undefined ? validatedInput.is_active : true,
    applies_to: validatedInput.applies_to || 'all',
    product_ids: validatedInput.product_ids || [],
    category_ids: validatedInput.category_ids || [],
  };

  if (validatedInput.id) {
    // Update existing - don't include merchant_id to prevent ownership bypass
    const { error } = await supabase
      .from('discount_codes')
      .update(baseDiscountCodeData)
      .eq('id', validatedInput.id)
      .eq('merchant_id', merchant.id) // Ensure ownership
      .select()
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
    const { error } = await supabase.from('discount_codes').insert({
      ...baseDiscountCodeData,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get merchant to verify ownership via RLS or explicit check
  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (merchantError || !merchant) {
    throw new Error('Merchant not found');
  }

  const { error } = await supabase
    .from('discount_codes')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchant.id) // Double check ownership
    .select()
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
