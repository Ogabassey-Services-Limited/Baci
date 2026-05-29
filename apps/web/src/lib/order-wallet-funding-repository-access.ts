import type { SupabaseClient } from '@supabase/supabase-js';
import { createOrderWalletFundingIntentRepository } from '@/lib/order-wallet-funding-intent-repository';
import type { OrderWalletFundingIntentRepository } from '@/lib/order-wallet-funding-intent-types';

export function getRepository({
  repository,
  supabase,
}: {
  repository?: OrderWalletFundingIntentRepository;
  supabase?: SupabaseClient;
}) {
  if (repository) return repository;
  if (!supabase) throw new Error('Supabase client is required');
  return createOrderWalletFundingIntentRepository(supabase);
}

export async function isWalletOrderAutoDebitEnabled(args: {
  merchantId: string;
  repository?: OrderWalletFundingIntentRepository;
  supabase?: SupabaseClient;
}) {
  const settings = await getRepository(args).getPaymentSettings(
    args.merchantId
  );
  return (
    settings.paystackEnabled &&
    settings.walletPaystackDvaEnabled &&
    settings.walletOrderAutoDebitEnabled
  );
}

export function getOrderWalletFundingIntent(args: {
  customerId: string;
  id: string;
  merchantId: string;
  repository?: OrderWalletFundingIntentRepository;
  supabase?: SupabaseClient;
}) {
  return getRepository(args).getOrderWalletFundingIntent(args);
}

/**
 * Expires stale funding intents using args.now when supplied; otherwise the
 * repository receives a fresh Date so tests can inject deterministic time.
 */
export function expireStaleWalletFundingIntents(args: {
  customerId?: string;
  merchantId?: string;
  now?: Date;
  repository?: OrderWalletFundingIntentRepository;
  supabase?: SupabaseClient;
  walletPaymentAccountId?: string;
}) {
  return getRepository(args).expireStaleWalletFundingIntents({
    customerId: args.customerId,
    merchantId: args.merchantId,
    now: args.now ?? new Date(),
    walletPaymentAccountId: args.walletPaymentAccountId,
  });
}

export function markWalletFundingIntentReviewRequired(args: {
  gatewayReference: string;
  intentIds: string[];
  reason: string;
  repository?: OrderWalletFundingIntentRepository;
  supabase?: SupabaseClient;
}) {
  return getRepository(args).markWalletFundingIntentReviewRequired(args);
}
