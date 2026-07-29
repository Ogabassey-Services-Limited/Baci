import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { invalidateStoreReadiness } from '@/lib/invalidate-store-readiness';
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

export function usePayouts() {
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

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
      if (!merchantId?.trim()) throw new Error('No merchant');
      return apiClient<CreateSubaccountResponse>('/api/paystack/subaccount', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: async () => {
      if (!merchantId?.trim()) throw new Error('No merchant');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['merchant'] }),
        queryClient.invalidateQueries({ queryKey: ['merchant-payout'] }),
        invalidateStoreReadiness(queryClient, merchantId),
      ]);
    },
  });

  return {
    resolveAccount: resolveAccountMutation,
    savePayoutSettings: savePayoutSettingsMutation,
  };
}
