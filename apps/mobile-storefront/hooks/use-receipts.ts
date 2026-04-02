/**
 * Receipts Hooks
 *
 * Data-fetching hooks for the receipts/invoices feature.
 * Follows the same patterns as use-products.ts with @tanstack/react-query.
 */

import { useQuery } from '@tanstack/react-query';
import { withSupabaseRetry } from '@/lib/api';
import { CONFIG } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import {
  MerchantReceiptInfoSchema,
  ReceiptDetailSchema,
  ReceiptListItemSchema,
} from '@/schemas/receipt';
import type {
  MerchantReceiptInfo,
  ReceiptDetail,
  ReceiptListItem,
} from '@/types/receipt';

const log = createLogger('Receipts');

const MERCHANT_SLUG = CONFIG.MERCHANT_SLUG || 'ogabassey';

/**
 * Fetch all orders for the current customer (receipt list view)
 */
export function useReceipts(customerId: string | undefined) {
  return useQuery<ReceiptListItem[]>({
    queryKey: ['receipts', customerId],
    queryFn: async () => {
      if (!customerId) return [];

      const { data, error } = await withSupabaseRetry(
        async () =>
          await supabase
            .from('orders')
            .select(
              `
              id,
              order_number,
              payment_status,
              total,
              amount_paid,
              currency,
              created_at,
              order_items (
                id,
                name,
                quantity,
                price
              )
            `
            )
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false }),
        { maxRetries: 3 }
      );

      if (error) throw error;

      const mapped = (data || []).map((order) => ({
        ...order,
        items: (order.order_items ?? []).map((item) => ({
          ...item,
          product_name: item.name,
        })),
      }));

      // Validate shape — warn on mismatch but don't block (data is from our own DB)
      const result = ReceiptListItemSchema.array().safeParse(mapped);
      if (!result.success) {
        log.warn('Receipt list validation warning:', result.error.message);
      }

      return mapped as ReceiptListItem[];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!customerId,
    // Override global offlineFirst — withSupabaseRetry already handles retries.
    // offlineFirst can cause infinite retry-pause loops when NetworkError
    // is thrown inside queryFn and react-query pauses then re-triggers.
    networkMode: 'always',
    retry: false,
  });
}

/** Standalone fetch for receipt detail — shared by hook and prefetch */
async function fetchReceiptDetail(orderId: string): Promise<ReceiptDetail> {
  // Fetch order + items
  const { data: order, error: orderError } = await withSupabaseRetry(
    async () =>
      await supabase
        .from('orders')
        .select(
          `
          id,
          order_number,
          payment_status,
          payment_method,
          total,
          subtotal,
          shipping_fee,
          discount_amount,
          tax_amount,
          amount_paid,
          currency,
          is_credit_order,
          created_at,
          notes,
          customer_name,
          customer_email,
          customer_phone,
          shipping_address,
          order_items (
            id,
            name,
            quantity,
            price
          )
        `
        )
        .eq('id', orderId)
        .single(),
    { maxRetries: 3 }
  );

  if (orderError) throw orderError;
  if (!order) throw new Error('Order not found');

  // Fetch virtual account (if any)
  const { data: virtualAccounts, error: vaError } = await withSupabaseRetry(
    async () =>
      await supabase
        .from('order_payment_accounts')
        .select('account_number, bank_name, account_name')
        .eq('order_id', orderId)
        .limit(1),
    { maxRetries: 2 }
  );
  if (vaError) log.warn('Failed to fetch virtual account:', vaError.message);

  // Fetch transactions (table is `transactions`, not `order_transactions`)
  const { data: transactions, error: txError } = await withSupabaseRetry(
    async () =>
      await supabase
        .from('transactions')
        .select('amount, created_at, description, metadata')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true }),
    { maxRetries: 2 }
  );
  if (txError) log.warn('Failed to fetch transactions:', txError.message);

  const detail = {
    ...order,
    // Compute balance from total and amount_paid (column doesn't exist in DB)
    balance: (order.total ?? 0) - (order.amount_paid ?? 0),
    items: (order.order_items ?? []).map((item) => ({
      ...item,
      product_name: item.name,
    })),
    virtual_account: virtualAccounts?.[0] ?? null,
    transactions: transactions ?? [],
  };

  // Validate shape — warn on mismatch but don't block
  const result = ReceiptDetailSchema.safeParse(detail);
  if (!result.success) {
    log.warn('Receipt detail validation warning:', result.error.message);
  }

  return detail as ReceiptDetail;
}

/** Query options for receipt detail — used by hook and prefetch */
export function receiptDetailQueryOptions(orderId: string) {
  return {
    queryKey: ['receipt-detail', orderId] as const,
    queryFn: () => fetchReceiptDetail(orderId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    networkMode: 'always' as const,
    retry: false,
  };
}

/**
 * Fetch full order detail for receipt HTML generation
 */
export function useReceiptDetail(orderId: string | null) {
  return useQuery<ReceiptDetail | null>({
    queryKey: ['receipt-detail', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      return fetchReceiptDetail(orderId);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!orderId,
    networkMode: 'always',
    retry: false,
  });
}

/**
 * Fetch merchant data needed for receipt branding
 * Extends the basic useMerchant() with bank details, VAT, social media, etc.
 */
export function useMerchantReceiptInfo() {
  return useQuery<MerchantReceiptInfo>({
    queryKey: ['merchant_receipt_info', MERCHANT_SLUG],
    queryFn: async () => {
      log.info('Fetching merchant receipt info for:', MERCHANT_SLUG);

      const { data, error } = await withSupabaseRetry(
        async () =>
          await supabase
            .from('merchants')
            .select(
              `
              business_name,
              logo_url,
              email,
              phone,
              support_email,
              support_phone,
              rider_phone_number,
              business_address,
              cac_rc_number,
              tax_identification_number,
              legal_entity_name,
              brand_colors,
              vat_registration_status,
              vat_rate,
              bank_code,
              bank_account_number,
              bank_name,
              bank_account_name,
              social_media,
              pages
            `
            )
            .eq('slug', MERCHANT_SLUG)
            .single(),
        { maxRetries: 3 }
      );

      if (error) throw error;
      if (!data) throw new Error('Merchant not found');

      // Validate shape — warn on mismatch but don't block
      const result = MerchantReceiptInfoSchema.safeParse(data);
      if (!result.success) {
        log.warn(
          'Merchant receipt info validation warning:',
          result.error.message
        );
      }

      return data as MerchantReceiptInfo;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    networkMode: 'always',
    retry: false,
  });
}
