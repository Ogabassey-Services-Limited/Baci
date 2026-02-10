import { useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { CONFIG } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { MOBILE_TO_KUDA_PROVIDER } from '@/lib/network-utils';
import { supabase } from '@/lib/supabase';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';
import { walletKeys } from './use-wallet';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://ogabassey.usebaci.com';

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

export interface VTUPurchaseResult {
  success: boolean;
  reference: string;
  transactionId?: string;
  amount: number;
  cashback?: {
    amount: number;
    credited: boolean;
    newBalance: number;
  };
}

export function useVTUPurchase() {
  const queryClient = useQueryClient();
  const customer = useAuthStore((state) => state.customer);

  return useMutation({
    mutationFn: async (
      params: VTUPurchaseParams
    ): Promise<VTUPurchaseResult> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Map mobile provider IDs to Kuda IDs
      const networkProvider = params.networkProvider
        ? MOBILE_TO_KUDA_PROVIDER[params.networkProvider] ||
          params.networkProvider
        : undefined;

      const response = await fetchWithTimeout(`${API_URL}/api/vtu/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify({
          merchantSlug: CONFIG.MERCHANT_SLUG,
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

      return data;
    },
    onSuccess: async (data) => {
      // Handle cashback notification
      if (data.cashback && data.cashback.amount > 0) {
        await scheduleLocalNotification(
          'Cashback Received! 🎉',
          `₦${data.cashback.amount.toLocaleString()} cashback added to your wallet.`,
          { type: 'wallet_cashback', amount: data.cashback.amount },
          1
        );

        // Invalidate wallet query so balance refreshes
        if (customer?.id) {
          queryClient.invalidateQueries({
            queryKey: walletKeys.data(customer.id),
          });
        }
      }
    },
  });
}
