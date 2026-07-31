import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
import { tryRefreshStoreReadiness } from '@/lib/try-refresh-store-readiness';
import { useMerchant } from './useMerchant';

interface ResolveAccountPayload {
  account_number: string;
  bank_code: string;
}

interface ResolveAccountResponse {
  account_name: string;
  account_number: string;
  bank_id: number | null;
}

interface CreateSubaccountPayload {
  bankCode: string;
  accountNumber: string;
  businessName: string;
}

interface CreateSubaccountResponse {
  subaccount_code?: string;
  business_name?: string;
  settlement_bank?: string;
  account_number?: string;
}

interface PendingPayoutSave {
  id: number;
  merchantId: string;
}

export function usePayouts() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();
  const merchantId = merchant?.id.trim();
  const nextPendingSaveId = useRef(0);
  const [pendingPayoutSaves, setPendingPayoutSaves] = useState<
    PendingPayoutSave[]
  >([]);

  // Resolve Bank Account
  const resolveAccountMutation = useMutation({
    mutationFn: (data: ResolveAccountPayload) =>
      apiClient<ResolveAccountResponse>('/api/paystack/resolve', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });

  // Create Subaccount (Save Payout Settings)
  const savePayoutSettingsMutation = useMutation({
    mutationFn: (data: CreateSubaccountPayload) => {
      if (!merchantId) {
        throw new Error('Merchant not loaded. Please try again.');
      }

      return apiClient<CreateSubaccountResponse>('/api/paystack/subaccount', {
        method: 'POST',
        body: JSON.stringify({ ...data, merchantId }),
      });
    },
    onMutate: () => {
      if (!merchantId) return { merchantId };

      const pendingSaveId = nextPendingSaveId.current;
      nextPendingSaveId.current += 1;
      setPendingPayoutSaves((pendingSaves) => [
        ...pendingSaves,
        { id: pendingSaveId, merchantId },
      ]);

      return { merchantId, pendingSaveId };
    },
    onSuccess: async (_data, _variables, context) => {
      const invalidations: Promise<unknown>[] = [
        queryClient.invalidateQueries({ queryKey: ['merchant'] }),
        queryClient.invalidateQueries({ queryKey: ['merchant-payout'] }),
      ];
      const readinessMerchantId = context?.merchantId;
      if (readinessMerchantId) {
        invalidations.push(
          tryRefreshStoreReadiness(() =>
            invalidateStoreReadiness(queryClient, readinessMerchantId)
          )
        );
      }
      await Promise.all(invalidations);
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context?.pendingSaveId === undefined) return;

      setPendingPayoutSaves((pendingSaves) =>
        pendingSaves.filter((save) => save.id !== context.pendingSaveId)
      );
    },
  });

  const isSavingPayoutSettings = merchantId
    ? pendingPayoutSaves.some((save) => save.merchantId === merchantId)
    : false;

  return {
    resolveAccount: resolveAccountMutation,
    savePayoutSettings: {
      ...savePayoutSettingsMutation,
      isPending: isSavingPayoutSettings,
    },
  };
}
