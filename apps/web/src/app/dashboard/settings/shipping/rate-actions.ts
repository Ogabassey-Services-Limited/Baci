'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { ensurePermission } from '@/lib/merchant-server';
import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';
import { createClient } from '@/lib/supabase/server';
import {
  type RateFormInput,
  rateFormSchema,
} from '@/schemas/merchant-shipping-rate-forms';
import {
  requireAuthenticatedSupabase,
  SHIPPING_SETTINGS_PATH,
} from './shipping-actions-shared';
import {
  ShippingRateNotFoundError,
  ShippingZoneNotFoundError,
} from './shipping-errors';

export async function upsertRate(
  input: unknown
): Promise<{ success: true; rateId: string }> {
  const parsed: RateFormInput = rateFormSchema.parse(input);
  await requireAuthenticatedSupabase();
  const { merchant } = await ensurePermission('settings', 'edit');
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: zone, error: zoneError } = await supabase
    .from('merchant_shipping_zones')
    .select('id')
    .eq('id', parsed.zoneId)
    .eq('merchant_id', merchant.id)
    .maybeSingle();

  if (zoneError) {
    throw new Error(zoneError.message);
  }
  if (!zone) {
    throw new ShippingZoneNotFoundError();
  }

  // Currency is NEVER taken from the client — always the merchant's own
  // resolved currency, so a tampered request can't stamp a rate in a
  // currency the store doesn't sell in.
  const currency = resolveMerchantCurrencyConfig(merchant).code;

  const payload = {
    merchant_id: merchant.id,
    zone_id: parsed.zoneId,
    name: parsed.name,
    kind: parsed.kind,
    currency,
    base_amount: parsed.baseAmount,
    condition_type: parsed.conditionType,
    min_subtotal: parsed.minSubtotal,
    max_subtotal: parsed.maxSubtotal,
    free_over_amount: parsed.freeOverAmount,
    delivery_min_days: parsed.deliveryMinDays,
    delivery_max_days: parsed.deliveryMaxDays,
    pickup_address: parsed.pickupAddress,
    sort_order: parsed.sortOrder,
    active: parsed.active,
  };

  if (parsed.id) {
    const { data: updated, error } = await supabase
      .from('merchant_shipping_rates')
      .update(payload)
      .eq('id', parsed.id)
      .eq('merchant_id', merchant.id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    // A stale or cross-merchant id filters out to zero rows; without this the
    // action would report success while nothing changed.
    if (!updated) {
      throw new ShippingRateNotFoundError();
    }

    revalidatePath(SHIPPING_SETTINGS_PATH);
    return { success: true, rateId: parsed.id };
  }

  const { data: created, error } = await supabase
    .from('merchant_shipping_rates')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(SHIPPING_SETTINGS_PATH);
  return { success: true, rateId: created.id };
}

export async function deleteRate(rateId: string): Promise<{ success: true }> {
  const parsedId = z.uuid().parse(rateId);
  await requireAuthenticatedSupabase();
  const { merchant } = await ensurePermission('settings', 'edit');
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: deleted, error } = await supabase
    .from('merchant_shipping_rates')
    .delete()
    .eq('id', parsedId)
    .eq('merchant_id', merchant.id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  // A stale or cross-merchant id deletes zero rows; without this the action
  // would report success while nothing was removed.
  if (!deleted) {
    throw new ShippingRateNotFoundError();
  }

  revalidatePath(SHIPPING_SETTINGS_PATH);
  return { success: true };
}

export async function toggleRateActive(
  rateId: string,
  active: boolean
): Promise<{ success: true }> {
  const parsedId = z.uuid().parse(rateId);
  const parsedActive = z.boolean().parse(active);
  await requireAuthenticatedSupabase();
  const { merchant } = await ensurePermission('settings', 'edit');
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: toggled, error } = await supabase
    .from('merchant_shipping_rates')
    .update({ active: parsedActive })
    .eq('id', parsedId)
    .eq('merchant_id', merchant.id)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  // A stale or cross-merchant id toggles zero rows; without this the action
  // would report success while nothing changed.
  if (!toggled) {
    throw new ShippingRateNotFoundError();
  }

  revalidatePath(SHIPPING_SETTINGS_PATH);
  return { success: true };
}
