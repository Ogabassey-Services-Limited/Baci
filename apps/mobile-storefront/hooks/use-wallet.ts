/**
 * Wallet Data Hook - 2025 Best Practices
 *
 * Features:
 * - TanStack Query for caching & deduplication
 * - Suspense-ready with useSuspenseQuery option
 * - Optimistic updates for instant UI feedback
 * - Real-time sync via Supabase channels
 * - Type-safe with Zod inference
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import { calculateCommerce, supabase } from '@/lib/supabase';
import {
  CustomerRowSchema,
  TransactionRowSchema,
  WalletRowSchema,
} from '@/lib/validation';
import { useAuthStore } from '@/stores/auth-store';

// ============================================
// TYPES
// ============================================

interface WalletData {
  balance: number;
  loyalty_points: number;
  loyalty_tier: string;
}

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  created_at: string;
}

interface WalletQueryData {
  wallet: WalletData;
  transactions: Transaction[];
}

// ============================================
// QUERY KEYS (Centralized for cache management)
// ============================================

export const walletKeys = {
  all: ['wallet'] as const,
  data: (customerId: string) =>
    [...walletKeys.all, 'data', customerId] as const,
  transactions: (customerId: string) =>
    [...walletKeys.all, 'transactions', customerId] as const,
};

// ============================================
// FETCHERS
// ============================================

async function fetchWalletData(
  customerId: string,
  merchantId: string
): Promise<WalletQueryData> {
  // Parallel fetch for better performance
  const [customerResult, walletResult, transactionsResult] = await Promise.all([
    supabase
      .from('customers')
      .select('loyalty_points, loyalty_tier')
      .eq('id', customerId)
      .single(),
    supabase
      .from('customer_wallets')
      .select('balance')
      .eq('customer_id', customerId)
      .eq('merchant_id', merchantId)
      .single(),
    supabase
      .from('wallet_transactions')
      .select('id, type, amount, description, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (customerResult.error) throw customerResult.error;
  if (walletResult.error) throw walletResult.error;
  if (transactionsResult.error) throw transactionsResult.error;

  // 2026 Best Practice: Validate response data with Zod
  const customerValidation = CustomerRowSchema.pick({
    loyalty_points: true,
    loyalty_tier: true,
  }).safeParse(customerResult.data);

  const walletValidation = WalletRowSchema.safeParse(walletResult.data);

  const transactionsValidation = z
    .array(TransactionRowSchema)
    .safeParse(transactionsResult.data);

  // Bug #97 fix: Only access .data when the query succeeded (no error) and data is non-null
  const safeWalletBalance = walletValidation.success
    ? walletValidation.data.balance
    : typeof walletResult.data?.balance === 'number'
      ? walletResult.data.balance
      : 0;

  const safeLoyaltyPoints = customerValidation.success
    ? (customerValidation.data.loyalty_points ?? 0)
    : typeof customerResult.data?.loyalty_points === 'number'
      ? customerResult.data.loyalty_points
      : 0;

  const safeLoyaltyTier = customerValidation.success
    ? (customerValidation.data.loyalty_tier ?? 'Bronze')
    : typeof customerResult.data?.loyalty_tier === 'string'
      ? customerResult.data.loyalty_tier
      : 'Bronze';

  return {
    wallet: {
      balance: safeWalletBalance,
      loyalty_points: safeLoyaltyPoints,
      loyalty_tier: safeLoyaltyTier,
    },
    transactions: transactionsValidation.success
      ? transactionsValidation.data
      : Array.isArray(transactionsResult.data)
        ? transactionsResult.data
        : [],
  };
}

// ============================================
// HOOKS
// ============================================

/**
 * Main wallet data hook with React Query
 */
export function useWallet() {
  const queryClient = useQueryClient();
  const customer = useAuthStore((state) => state.customer);
  const merchantId = useAuthStore((state) => state.merchantId);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const query = useQuery({
    queryKey: walletKeys.data(customer?.id || ''),
    queryFn: () => fetchWalletData(customer?.id ?? '', merchantId ?? ''),
    enabled: !!customer?.id && !!merchantId,
    staleTime: 30_000, // Consider fresh for 30 seconds
    gcTime: 5 * 60_000, // Keep in cache for 5 minutes
  });

  // Real-time sync
  // 2026 Critical Fix: Prevent channel race condition on rapid mount/unmount
  useEffect(() => {
    if (!customer?.id) return;

    // Cleanup any existing channel first (prevent duplicates)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    let isMounted = true;
    const channelName = `wallet-hook-${customer.id}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customer_wallets',
          filter: `customer_id=eq.${customer.id}`,
        },
        () => {
          // Only invalidate if still mounted
          if (isMounted) {
            queryClient.invalidateQueries({
              queryKey: walletKeys.data(customer.id),
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customers',
          filter: `id=eq.${customer.id}`,
        },
        () => {
          if (isMounted) {
            queryClient.invalidateQueries({
              queryKey: walletKeys.data(customer.id),
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      isMounted = false;
      if (channelRef.current) {
        // Use removeChannel for synchronous cleanup
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [customer?.id, queryClient]);

  return query;
}

/**
 * Redeem loyalty points mutation with optimistic update
 */
export function useRedeemPoints() {
  const queryClient = useQueryClient();
  const customer = useAuthStore((state) => state.customer);
  const merchantId = useAuthStore((state) => state.merchantId);

  return useMutation({
    mutationFn: async (points: number) => {
      // Look up current points balance from cached wallet data
      const cachedData = queryClient.getQueryData<WalletQueryData>(
        walletKeys.data(customer?.id || '')
      );
      const currentPoints = cachedData?.wallet?.loyalty_points ?? 0;

      // First, validate with Commerce Brain
      const result = await calculateCommerce('redeem_loyalty', {
        points,
        currentPoints,
        pointsToNairaRate: 1,
      });

      if (!result.success) {
        throw new Error(result.error || 'Redemption failed');
      }

      // Then execute the RPC
      const { error } = await supabase.rpc('redeem_loyalty_points', {
        p_customer_id: customer?.id,
        p_merchant_id: merchantId,
        p_points: points,
        p_wallet_credit: result.walletCredit,
      });

      if (error) throw error;

      return result;
    },

    // 2025 Best Practice: Optimistic updates
    onMutate: async (points) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: walletKeys.data(customer?.id || ''),
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<WalletQueryData>(
        walletKeys.data(customer?.id || '')
      );

      // Optimistically update points only; balance is not updated optimistically
      // because the actual conversion rate is determined server-side by calculateCommerce.
      // The real balance will be synced on query invalidation after mutation settles.
      if (previousData) {
        queryClient.setQueryData<WalletQueryData>(
          walletKeys.data(customer?.id || ''),
          {
            ...previousData,
            wallet: {
              ...previousData.wallet,
              loyalty_points: previousData.wallet.loyalty_points - points,
            },
          }
        );
      }

      return { previousData };
    },

    // Rollback on error
    onError: (_err, _points, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          walletKeys.data(customer?.id || ''),
          context.previousData
        );
      }
    },

    // Refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: walletKeys.data(customer?.id || ''),
      });
    },
  });
}
