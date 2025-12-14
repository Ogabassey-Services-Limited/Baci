'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

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

  // Validation
  if (!input.code || !input.discount_type || !input.discount_value) {
    throw new Error('Missing required fields');
  }

  const discountCodeData = {
    merchant_id: merchant.id,
    code: input.code.toUpperCase(),
    description: input.description || null,
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    minimum_purchase_amount: input.minimum_purchase_amount || 0,
    maximum_discount_amount: input.maximum_discount_amount || null,
    usage_limit: input.usage_limit || null,
    usage_limit_per_customer: input.usage_limit_per_customer || 1,
    starts_at: input.starts_at || null,
    expires_at: input.expires_at || null,
    is_active: input.is_active !== undefined ? input.is_active : true,
    applies_to: input.applies_to || 'all',
    product_ids: input.product_ids || [],
    category_ids: input.category_ids || [],
  };

  if (input.id) {
    // Update existing
    const { data, error } = await supabase
      .from('discount_codes')
      .update(discountCodeData)
      .eq('id', input.id)
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

    if (!data) {
      throw new Error('Discount code not found');
    }
  } else {
    // Create new
    const { error } = await supabase
      .from('discount_codes')
      .insert(discountCodeData);

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

  const { data, error } = await supabase
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

  if (!data) {
    throw new Error('Discount code not found');
  }

  revalidatePath('/dashboard/marketing/discount-codes');
  return { success: true };
}
