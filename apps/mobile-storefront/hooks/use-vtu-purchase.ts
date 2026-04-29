import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { EXPO_PUBLIC_API_URL } from '@/env';
import { CONFIG } from '@/lib/config';
import { DEFAULT_TIMEOUT, fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { MOBILE_TO_KUDA_PROVIDER } from '@/lib/network-utils';
import { supabase } from '@/lib/supabase';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';
import { walletKeys } from './use-wallet';

const API_URL = EXPO_PUBLIC_API_URL;

export interface VTUPurchaseParams {
  type: 'airtime' | 'data' | 'electricity' | 'cable_tv' | 'betting';
  phoneNumber?: string;
  amount: number;
  networkProvider?: string;
  dataPlanCode?: string;
  billItemIdentifier?: string;
  customerIdentifier?: string;
  billerName?: string;
}

/** Bug #62: Zod schema to validate API response at runtime */
const VTUPurchaseResultSchema = z.object({
  success: z.boolean(),
  reference: z.string(),
  transactionId: z.string().optional(),
  voucherPin: z.string().optional(),
  amount: z.number(),
  cashback: z
    .object({
      amount: z.number(),
      credited: z.boolean(),
      newBalance: z.number(),
    })
    .optional(),
});

export type VTUPurchaseResult = z.infer<typeof VTUPurchaseResultSchema>;

export function useVTUPurchase() {
  const queryClient = useQueryClient();
  const customer = useAuthStore((state) => state.customer);

  return useMutation({
    mutationFn: async (
      params: VTUPurchaseParams
    ): Promise<VTUPurchaseResult> => {
      // H6 fix: Use getUser() for secure JWT validation, then getSession() for access token
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Map mobile provider IDs to Kuda IDs
      const networkProvider = params.networkProvider
        ? MOBILE_TO_KUDA_PROVIDER[params.networkProvider] ||
          params.networkProvider
        : undefined;

      // Bug #75: Explicit 30s timeout to prevent hanging requests
      const response = await fetchWithTimeout(`${API_URL}/api/vtu/purchase`, {
        method: 'POST',
        timeout: DEFAULT_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify({
          merchantSlug: CONFIG.MERCHANT_SLUG,
          source: 'direct',
          type: params.type,
          amount: params.amount,
          phoneNumber: params.phoneNumber,
          networkProvider,
          dataPlanCode: params.dataPlanCode,
          billItemIdentifier: params.billItemIdentifier,
          customerIdentifier: params.customerIdentifier,
          billerName: params.billerName,
          customerId: customer?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Purchase failed. Please try again.');
      }

      // Bug #62: Validate API response against schema
      const parsed = VTUPurchaseResultSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(
          'Unexpected response from server. Please contact support if the issue persists.'
        );
      }

      return parsed.data;
    },
    onSuccess: (data) => {
      // Handle cashback notification
      if (data.cashback && data.cashback.amount > 0) {
        void scheduleLocalNotification(
          'Cashback Received! 🎉',
          `₦${data.cashback.amount.toLocaleString()} cashback added to your wallet.`,
          {
            type: 'wallet_cashback',
            amount: data.cashback.amount,
          },
          1
        ).catch((err) => {
          // Notification delivery should not keep VTU purchases pending.
          console.debug('[VTU] Cashback notification scheduling failed:', err);
        });

        // Invalidate wallet query so balance refreshes
        if (customer?.id) {
          void queryClient.invalidateQueries({
            queryKey: walletKeys.data(customer.id),
          });
        }
      }
    },
  });
}
