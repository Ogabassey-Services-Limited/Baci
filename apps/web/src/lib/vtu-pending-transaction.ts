import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  formatPhoneNumber,
  generateRequestRef,
  isValidPhoneNumber,
} from '@/lib/kuda';
import { calculateCommerce } from '@/lib/supabase/client';
import { COMMISSION_CATEGORY_MAP, type PurchaseInput } from '@/schemas/vtu';

export const VTU_TYPE_LABELS: Record<PurchaseInput['type'], string> = {
  airtime: 'Airtime',
  data: 'Data',
  electricity: 'Electricity',
  cable_tv: 'TV Subscription',
  betting: 'Betting Top-up',
};

interface CustomerRecord {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  user_id: string | null;
}

interface MerchantRecord {
  id: string;
  slug: string;
  business_name: string;
  paystack_subaccount_code: string | null;
}

interface FeatureSettingsRecord {
  vtu_enabled: boolean | null;
  vtu_airtime_enabled: boolean | null;
  vtu_data_enabled: boolean | null;
  vtu_electricity_enabled: boolean | null;
  vtu_tv_enabled: boolean | null;
  vtu_betting_enabled: boolean | null;
  vtu_merchant_commission_rate: number | null;
  vtu_customer_cashback_enabled: boolean | null;
  vtu_customer_cashback_rate: number | null;
  paystack_enabled: boolean | null;
  korapay_enabled: boolean | null;
}

export interface PreparedVtuTransaction {
  customer: CustomerRecord | null;
  customerCashback: number;
  effectiveMerchantEarning: number;
  merchant: MerchantRecord;
  platformEarning: number;
  requestReference: string;
  transaction: {
    id: string;
    amount: number;
    customer_identifier: string | null;
    metadata: Record<string, unknown> | null;
    request_reference: string;
    status: string;
    type: PurchaseInput['type'];
  };
}

export async function resolveVtuCustomer({
  supabase,
  merchantId,
  user,
}: {
  supabase: SupabaseClient;
  merchantId: string;
  user: User;
}) {
  const { data: byUserId } = await supabase
    .from('customers')
    .select('id, email, first_name, last_name, phone, user_id')
    .eq('merchant_id', merchantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (byUserId) {
    return byUserId as CustomerRecord;
  }

  if (!user.email) {
    return null;
  }

  const { data: byEmail } = await supabase
    .from('customers')
    .select('id, email, first_name, last_name, phone, user_id')
    .eq('merchant_id', merchantId)
    .eq('email', user.email)
    .maybeSingle();

  if (byEmail && !byEmail.user_id) {
    await supabase
      .from('customers')
      .update({ user_id: user.id })
      .eq('id', byEmail.id);
  }

  return (byEmail as CustomerRecord | null) ?? null;
}

export async function preparePendingVtuTransaction({
  supabase,
  user,
  input,
  source,
  requireCustomer = false,
}: {
  supabase: SupabaseClient;
  user: User;
  input: PurchaseInput;
  source: PurchaseInput['source'];
  requireCustomer?: boolean;
}): Promise<PreparedVtuTransaction> {
  const isTelco = input.type === 'airtime' || input.type === 'data';
  const formattedPhone =
    isTelco && input.phoneNumber ? formatPhoneNumber(input.phoneNumber) : '';

  if (isTelco && (!formattedPhone || !isValidPhoneNumber(formattedPhone))) {
    throw new Error('Invalid phone number');
  }

  const { data: merchant, error: merchantError } = await supabase
    .from('merchants')
    .select('id, slug, business_name, paystack_subaccount_code')
    .eq('slug', input.merchantSlug)
    .single();

  if (merchantError || !merchant) {
    throw new Error('Merchant not found');
  }

  const { data: settings } = await supabase
    .from('merchant_feature_settings')
    .select(
      'vtu_enabled, vtu_airtime_enabled, vtu_data_enabled, vtu_electricity_enabled, vtu_tv_enabled, vtu_betting_enabled, vtu_merchant_commission_rate, vtu_customer_cashback_enabled, vtu_customer_cashback_rate, paystack_enabled, korapay_enabled'
    )
    .eq('merchant_id', merchant.id)
    .single();

  const featureSettings = (settings ?? {}) as FeatureSettingsRecord;
  if (!featureSettings.vtu_enabled) {
    throw new Error('VTU is not enabled for this merchant');
  }

  const typeFlags: Record<PurchaseInput['type'], boolean | null | undefined> = {
    airtime: featureSettings.vtu_airtime_enabled,
    data: featureSettings.vtu_data_enabled,
    electricity: featureSettings.vtu_electricity_enabled,
    cable_tv: featureSettings.vtu_tv_enabled,
    betting: featureSettings.vtu_betting_enabled,
  };

  if (typeFlags[input.type] === false) {
    throw new Error(`${VTU_TYPE_LABELS[input.type]} purchases are not enabled`);
  }

  const customer = await resolveVtuCustomer({
    supabase,
    merchantId: merchant.id,
    user,
  });

  if (requireCustomer && !customer) {
    throw new Error('Customer account not found for this storefront');
  }

  const merchantSplitPercentage = featureSettings.vtu_merchant_commission_rate
    ? featureSettings.vtu_merchant_commission_rate * 100
    : 50;
  const purchaseType = input.type as keyof typeof COMMISSION_CATEGORY_MAP;
  const commissionProvider = isTelco
    ? (input.networkProvider ?? '')
    : (input.billerName ?? 'DEFAULT');

  const commissions = await calculateCommerce('calculate_vtu', {
    amount: input.amount,
    provider: commissionProvider,
    category: COMMISSION_CATEGORY_MAP[purchaseType],
    merchantSplit: merchantSplitPercentage,
  });

  const customerCashbackEnabled =
    featureSettings.vtu_customer_cashback_enabled ?? false;
  const customerCashbackRate = featureSettings.vtu_customer_cashback_rate ?? 50;
  const customerCashback =
    customerCashbackEnabled && customer?.id
      ? Math.round(
          ((commissions.merchantEarning * customerCashbackRate) / 100) * 100
        ) / 100
      : 0;
  const effectiveMerchantEarning =
    commissions.merchantEarning - customerCashback;
  const requestReference = generateRequestRef();

  const { data: transaction, error: transactionError } = await supabase
    .from('vtu_transactions')
    .insert({
      merchant_id: merchant.id,
      customer_id: customer?.id ?? input.customerId ?? null,
      order_id: input.orderId ?? null,
      type: input.type,
      network_provider: isTelco
        ? input.networkProvider
        : (input.billerName ?? ''),
      phone_number: isTelco ? formattedPhone : (input.customerIdentifier ?? ''),
      amount: input.amount,
      request_reference: requestReference,
      status: 'pending',
      source,
      platform_commission: commissions.platformEarning,
      merchant_commission: effectiveMerchantEarning,
      customer_cashback: customerCashback,
      biller_name: input.billerName ?? null,
      biller_item_code: input.billItemIdentifier ?? null,
      customer_identifier: input.customerIdentifier ?? null,
      metadata: {
        dataPlanCode: input.dataPlanCode,
        originalPhoneNumber: input.phoneNumber,
        originalMerchantCommission: commissions.merchantEarning,
        customerCashbackEnabled,
        customerCashbackRate,
        paystackEnabled: featureSettings.paystack_enabled ?? true,
        korapayEnabled: featureSettings.korapay_enabled ?? true,
        paymentPending: true,
      },
    })
    .select(
      'id, amount, customer_identifier, metadata, request_reference, status, type'
    )
    .single();

  if (transactionError || !transaction) {
    throw new Error('Failed to initiate purchase');
  }

  return {
    customer,
    customerCashback,
    effectiveMerchantEarning,
    merchant: merchant as MerchantRecord,
    platformEarning: commissions.platformEarning,
    requestReference,
    transaction: transaction as PreparedVtuTransaction['transaction'],
  };
}
