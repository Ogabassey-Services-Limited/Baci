import type { RealtimeChannel } from '@supabase/supabase-js';
import { VTU_MIN_REDEEMABLE_POINTS } from '@baci/shared/lib';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef } from 'react';
import { z } from 'zod';
import { useShallow } from 'zustand/react/shallow';
import { CONFIG } from '@/lib/config';
import {
  clearPendingLoyaltyRedemptionId,
  getOrCreatePendingLoyaltyRedemptionId,
  getPendingLoyaltyRedemptionStorageKey,
} from '@/lib/loyalty-redemption-idempotency';
import { calculateCommerce, supabase } from '@/lib/supabase';
import { CustomerRowSchema, TransactionRowSchema } from '@/lib/validation';
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
    | 'expiry'
    | 'refund';
  amount: number;
  description: string;
  created_at: string;
}

interface WalletQueryData {
  wallet: WalletData;
  transactions: Transaction[];
}

const WalletTransactionDataSchema = TransactionRowSchema.omit({
  amount: true,
  id: true,
}).extend({
  amount: z.union([z.number(), z.string()]),
  id: z.string(),
});

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

const WALLET_QUERY_ROOT = ['wallet'] as const;

interface WalletDataKeyInput {
  merchantId: string;
  ownerId: string;
}

function walletDataKey(
  owner: WalletDataKeyInput
): readonly ['wallet', 'data', 'v3', string, string] {
  if (!owner.merchantId) {
    throw new Error('wallet data query keys require a merchantId');
  }

  return [
    ...WALLET_QUERY_ROOT,
    'data',
    'v3',
    owner.ownerId,
    owner.merchantId,
  ] as const;
}

export const walletKeys = {
  all: WALLET_QUERY_ROOT,
  data: walletDataKey,
  transactions: (customerId: string) =>
    [...walletKeys.all, 'transactions', customerId] as const,
};

type WalletQueryKey = ReturnType<typeof walletKeys.data>;

function redemptionBalanceSnapshotKey({
  customerId,
  merchantId,
  points,
}: {
  customerId: string;
  merchantId: string;
  points: number;
}) {
  return `${customerId}:${merchantId}:${points}`;
}

// ============================================
// FETCHERS
// ============================================

function coerceDatabaseNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    const numericValue = Number(trimmedValue);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return null;
}

function normalizeWalletTransaction(row: unknown): Transaction | null {
  const validation = WalletTransactionDataSchema.safeParse(row);
  if (!validation.success) {
    return null;
  }

  const amount = coerceDatabaseNumber(validation.data.amount);
  if (amount === null) {
    return null;
  }

  return {
    ...validation.data,
    amount,
    description: validation.data.description ?? '',
  };
}

function getEmptyWalletData(loyaltyPoints: unknown = 0): WalletQueryData {
  return {
    wallet: {
      balance: 0,
      loyalty_points: coerceDatabaseNumber(loyaltyPoints) ?? 0,
    },
    transactions: [],
  };
}

async function fetchWalletData(
  customerId: string | null,
  merchantId: string,
  userId: string | null
): Promise<WalletQueryData> {
  // Step 1: Resolve the customer first. On app restore, the auth user can be
  // ready before customer hydration finishes, so fall back to RLS-scoped lookup.
  let customerQuery = supabase
    .from('customers')
    .select('id, loyalty_points')
    .eq('merchant_id', merchantId);

  if (customerId) {
    customerQuery = customerQuery.eq('id', customerId);
  } else if (userId) {
    customerQuery = customerQuery.eq('user_id', userId);
  }

  const customerResult = await customerQuery.limit(2);

  if (customerResult.error) throw customerResult.error;

  const customerRows = Array.isArray(customerResult.data)
    ? customerResult.data
    : [];

  if (customerRows.length === 0) {
    return getEmptyWalletData();
  }

  if (customerRows.length > 1) {
    console.warn('Expected one customer wallet owner, received multiple rows', {
      customerId,
      merchantId,
      userId,
    });
    return getEmptyWalletData();
  }

  const customerRow = customerRows[0];
  const resolvedCustomerId =
    customerId ?? (typeof customerRow.id === 'string' ? customerRow.id : '');

  // Without a customer_id filter, customer_wallets.maybeSingle() can fail as
  // soon as the merchant has more than one wallet. Return the empty wallet
  // state until auth/customer hydration can provide a scoped customer.
  if (!resolvedCustomerId) {
    const customerValidation = CustomerRowSchema.pick({
      loyalty_points: true,
    }).safeParse(customerRow);
    const safeLoyaltyPoints =
      customerValidation.success &&
      customerValidation.data.loyalty_points != null
        ? (coerceDatabaseNumber(customerValidation.data.loyalty_points) ?? 0)
        : (coerceDatabaseNumber(customerRow.loyalty_points) ?? 0);

    return {
      wallet: {
        balance: 0,
        loyalty_points: safeLoyaltyPoints,
      },
      transactions: [],
    };
  }

  let walletQuery = supabase
    .from('customer_wallets')
    .select('id, available_balance')
    .eq('merchant_id', merchantId);

  walletQuery = walletQuery.eq('customer_id', resolvedCustomerId);

  const walletResult = await walletQuery.maybeSingle();

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

    if (txResult.error) throw txResult.error;

    if (txResult.data) {
      transactionRows = txResult.data.reduce<Transaction[]>((rows, row) => {
        const transaction = normalizeWalletTransaction(row);
        if (transaction) {
          rows.push(transaction);
        }
        return rows;
      }, []);
    }
  }

  // Validate customer data
  const customerValidation = CustomerRowSchema.pick({
    loyalty_points: true,
  }).safeParse(customerRow);

  const safeBalance =
    coerceDatabaseNumber(walletResult.data?.available_balance) ?? 0;

  const safeLoyaltyPoints =
    customerValidation.success && customerValidation.data.loyalty_points != null
      ? (coerceDatabaseNumber(customerValidation.data.loyalty_points) ?? 0)
      : (coerceDatabaseNumber(customerRow.loyalty_points) ?? 0);

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
  const { customer, merchantId, user } = useAuthStore(
    useShallow((state) => ({
      customer: state.customer,
      merchantId: state.merchantId,
      user: state.user,
    }))
  );
  const channelRef = useRef<RealtimeChannel | null>(null);
  const walletOwnerId = customer?.id ?? user?.id ?? '';
  const activeMerchantId = merchantId || CONFIG.MERCHANT_ID;

  const query = useQuery({
    queryKey: walletKeys.data({
      merchantId: activeMerchantId,
      ownerId: walletOwnerId,
    }),
    queryFn: () =>
      fetchWalletData(customer?.id ?? null, activeMerchantId, user?.id ?? null),
    enabled: !!walletOwnerId && !!activeMerchantId,
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
              queryKey: walletKeys.data({
                merchantId: activeMerchantId,
                ownerId: customer.id,
              }),
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
              queryKey: walletKeys.data({
                merchantId: activeMerchantId,
                ownerId: customer.id,
              }),
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
  }, [activeMerchantId, customer?.id, queryClient]);

  return query;
}

/**
 * Redeem loyalty points mutation with optimistic update
 */
function getRedeemPointValidationError(points: number) {
  if (!Number.isSafeInteger(points) || points <= 0) {
    return 'Invalid redemption amount';
  }

  if (points < VTU_MIN_REDEEMABLE_POINTS) {
    return 'Minimum redemption is 100 points';
  }

  if (points % VTU_MIN_REDEEMABLE_POINTS !== 0) {
    return 'Redeem points in 100-point blocks';
  }

  return null;
}

export function useRedeemPoints() {
  const queryClient = useQueryClient();
  const redemptionAttemptIdsRef = useRef(new Map<string, string>());
  const redemptionBalanceSnapshotsRef = useRef(new Map<string, number>());
  const { customer, merchantId, user } = useAuthStore(
    useShallow((state) => ({
      customer: state.customer,
      merchantId: state.merchantId,
      user: state.user,
    }))
  );
  const activeMerchantId = merchantId || CONFIG.MERCHANT_ID;

  return useMutation({
    mutationFn: async (points: number) => {
      if (!customer?.id || !activeMerchantId) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const validationError = getRedeemPointValidationError(points);
      if (validationError) {
        throw new Error(validationError);
      }

      // Capture in local variables to prevent stale closure if auth changes mid-request
      const customerId = customer.id;
      const currentMerchantId = activeMerchantId;
      const balanceSnapshotKey = redemptionBalanceSnapshotKey({
        customerId,
        merchantId: currentMerchantId,
        points,
      });
      const attemptId =
        redemptionAttemptIdsRef.current.get(balanceSnapshotKey) ??
        Crypto.randomUUID();
      redemptionAttemptIdsRef.current.set(balanceSnapshotKey, attemptId);

      // Look up current points balance from cached wallet data
      const cachedData = queryClient.getQueryData<WalletQueryData>(
        walletKeys.data({
          merchantId: currentMerchantId,
          ownerId: customerId,
        })
      );
      const currentPoints =
        redemptionBalanceSnapshotsRef.current.get(balanceSnapshotKey) ??
        cachedData?.wallet?.loyalty_points ??
        0;

      if (points > currentPoints) {
        throw new Error('Insufficient loyalty points');
      }

      // First, validate with Commerce Brain
      const result = await calculateCommerce('redeem_loyalty', {
        points,
        currentPoints,
        pointsToNairaRate: 1,
      });

      if (!result.success) {
        throw new Error(result.error || 'Redemption failed');
      }

      const { redemptionId } = await getOrCreatePendingLoyaltyRedemptionId({
        attemptId,
        createId: () => attemptId,
        customerId,
        currentPoints,
        merchantId: currentMerchantId,
        points,
      });

      // Then execute the RPC
      const { data: rpcData, error } = await supabase.rpc(
        'redeem_loyalty_points',
        {
          p_customer_id: customerId,
          p_merchant_id: currentMerchantId,
          p_points: points,
          p_redemption_id: redemptionId,
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
      const walletOwnerId = customer?.id ?? user?.id ?? '';
      if (!walletOwnerId || !activeMerchantId) {
        return {
          previousData: undefined,
          queryKey: undefined,
          redemptionKey: undefined,
          snapshotKey: undefined,
        };
      }

      if (getRedeemPointValidationError(points)) {
        return {
          previousData: undefined,
          queryKey: undefined,
          redemptionKey: undefined,
          snapshotKey: undefined,
        };
      }

      const snapshotKey = customer?.id
        ? redemptionBalanceSnapshotKey({
            customerId: customer.id,
            merchantId: activeMerchantId,
            points,
          })
        : undefined;
      const redemptionKey = customer?.id
        ? getPendingLoyaltyRedemptionStorageKey({
            customerId: customer.id,
            merchantId: activeMerchantId,
            points,
          })
        : undefined;

      const queryKey: WalletQueryKey = walletKeys.data({
        merchantId: activeMerchantId,
        ownerId: walletOwnerId,
      });

      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey,
      });

      // Snapshot previous value
      const previousData = queryClient.getQueryData<WalletQueryData>(queryKey);

      if (previousData && previousData.wallet.loyalty_points < points) {
        return { previousData, queryKey, redemptionKey, snapshotKey };
      }

      if (previousData && snapshotKey) {
        redemptionBalanceSnapshotsRef.current.set(
          snapshotKey,
          previousData.wallet.loyalty_points
        );
      }

      // Optimistically update points only; balance is not updated optimistically
      // because the actual conversion rate is determined server-side by calculateCommerce.
      // The real balance will be synced on query invalidation after mutation settles.
      if (previousData) {
        const nextLoyaltyPoints = previousData.wallet.loyalty_points - points;

        queryClient.setQueryData<WalletQueryData>(queryKey, {
          ...previousData,
          wallet: {
            ...previousData.wallet,
            loyalty_points: nextLoyaltyPoints,
          },
        });
      }

      return { previousData, queryKey, redemptionKey, snapshotKey };
    },

    onSuccess: async (_data, _points, context) => {
      if (context?.redemptionKey) {
        await clearPendingLoyaltyRedemptionId(context.redemptionKey);
      }

      if (context?.snapshotKey) {
        redemptionAttemptIdsRef.current.delete(context.snapshotKey);
      }
    },

    // Rollback on error
    onError: (_err, _points, context) => {
      if (context?.previousData && context.queryKey) {
        queryClient.setQueryData(context.queryKey, context.previousData);
      }
    },

    // Refetch after success or error
    onSettled: (_data, _error, _points, context) => {
      if (context?.snapshotKey) {
        redemptionBalanceSnapshotsRef.current.delete(context.snapshotKey);
      }

      if (context?.queryKey) {
        queryClient.invalidateQueries({
          queryKey: context.queryKey,
        });
      }
    },
  });
}
