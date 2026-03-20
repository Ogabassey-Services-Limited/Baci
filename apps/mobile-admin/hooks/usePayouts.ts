import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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
    mutationFn: (data: CreateSubaccountPayload) =>
      apiClient<CreateSubaccountResponse>('/api/paystack/subaccount', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-payout'] });
      queryClient.invalidateQueries({ queryKey: ['store-readiness'] });
    },
  });

  return {
    resolveAccount: resolveAccountMutation,
    savePayoutSettings: savePayoutSettingsMutation,
  };
}
