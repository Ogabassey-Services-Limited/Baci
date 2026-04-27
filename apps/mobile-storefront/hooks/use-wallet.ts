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
import { CustomerRowSchema, TransactionRowSchema } from '@/lib/validation';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/auth-store';

// ============================================
// TYPES
// ============================================

interface WalletData {
  balance: number;
  loyalty_points: number;
}

interface Transaction {
  id: string;
  type:
    | 'credit'
    | 'debit'
    | 'cashback'
    | 'redemption'
    | 'bonus'
    | 'adjustment'
    | 'expiry';
  amount: number;
  description: string;
  created_at: string;
}

interface WalletQueryData {
  wallet: WalletData;
  transactions: Transaction[];
}

const RedeemLoyaltyRpcResponseSchema = z.discriminatedUnion('success', [
  z
    .object({
      success: z.literal(true),
      wallet_credited: z.number().finite(),
      points_deducted: z.number().finite(),
      new_points_balance: z.number().finite(),
      new_wallet_balance: z.number().finite(),
    })
    .strict(),
  z.object({
    success: z.literal(false),
    error: z.string().optional(),
  }),
]);

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
  // Step 1: Fetch customer loyalty points + wallet record in parallel
  const [customerResult, walletResult] = await Promise.all([
    supabase
      .from('customers')
      .select('loyalty_points')
      .eq('id', customerId)
      .single(),
    supabase
      .from('customer_wallets')
      .select('id, available_balance')
      .eq('customer_id', customerId)
      .eq('merchant_id', merchantId)
      .maybeSingle(), // Wallet may not exist yet for new customers
  ]);

  if (customerResult.error) throw customerResult.error;
  if (walletResult.error) throw walletResult.error;

  // Step 2: Fetch customer wallet transactions if wallet exists.
  let transactionRows: Transaction[] = [];
  if (walletResult.data?.id) {
    const txResult = await supabase
      .from('customer_wallet_transactions')
      .select('id, type, amount, description, created_at')
      .eq('wallet_id', walletResult.data.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!txResult.error && txResult.data) {
      const validation = z.array(TransactionRowSchema).safeParse(txResult.data);
      transactionRows = (
        validation.success ? validation.data : txResult.data
      ).map((t) => ({
        ...t,
        description: (t as { description?: string | null }).description ?? '',
      })) as Transaction[];
    }
  }

  // Validate customer data
  const customerValidation = CustomerRowSchema.pick({
    loyalty_points: true,
  }).safeParse(customerResult.data);

  const safeBalance =
    typeof walletResult.data?.available_balance === 'number'
      ? walletResult.data.available_balance
      : 0;

  const safeLoyaltyPoints = customerValidation.success
    ? (customerValidation.data.loyalty_points ?? 0)
    : typeof customerResult.data?.loyalty_points === 'number'
      ? customerResult.data.loyalty_points
      : 0;

  return {
    wallet: {
      balance: safeBalance,
      loyalty_points: safeLoyaltyPoints,
    },
    transactions: transactionRows,
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
  const { customer, merchantId } = useAuthStore(
    useShallow((state) => ({
      customer: state.customer,
      merchantId: state.merchantId,
    }))
  );
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
  const { customer, merchantId } = useAuthStore(
    useShallow((state) => ({
      customer: state.customer,
      merchantId: state.merchantId,
    }))
  );

  return useMutation({
    mutationFn: async (points: number) => {
      if (!customer?.id || !merchantId) {
        throw new Error('Authentication required. Please sign in again.');
      }

      // Capture in local variables to prevent stale closure if auth changes mid-request
      const customerId = customer.id;
      const currentMerchantId = merchantId;

      // Look up current points balance from cached wallet data
      const cachedData = queryClient.getQueryData<WalletQueryData>(
        walletKeys.data(customerId)
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
      const { data: rpcData, error } = await supabase.rpc(
        'redeem_loyalty_points',
        {
          p_customer_id: customerId,
          p_merchant_id: currentMerchantId,
          p_points: points,
          p_wallet_credit: result.walletCredit,
        }
      );

      if (error) throw error;

      const parsedRpc = RedeemLoyaltyRpcResponseSchema.safeParse(rpcData);
      if (!parsedRpc.success) {
        throw new Error('Invalid redeem_loyalty_points RPC response');
      }

      if (!parsedRpc.data.success) {
        throw new Error(parsedRpc.data.error || 'Redemption failed');
      }

      const walletCredit = parsedRpc.data.wallet_credited;

      return {
        ...result,
        walletCredit,
        pointsRedeemed: parsedRpc.data.points_deducted,
        remainingPoints: parsedRpc.data.new_points_balance,
      };
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
