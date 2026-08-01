import {
  type MutateOptions,
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
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

interface SubmittedPayoutSave extends CreateSubaccountPayload {
  merchantId: string;
}

interface PayoutSaveMutationContext extends PendingPayoutSave {}

type PublicPayoutSaveMutation = Pick<
  UseMutationResult<CreateSubaccountResponse, Error, CreateSubaccountPayload>,
  'isPending'
> & {
  mutate: (
    data: CreateSubaccountPayload,
    options?: MutateOptions<
      CreateSubaccountResponse,
      Error,
      CreateSubaccountPayload
    >
  ) => void;
  mutateAsync: (
    data: CreateSubaccountPayload
  ) => Promise<CreateSubaccountResponse>;
};

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
  const savePayoutSettingsMutation = useMutation<
    CreateSubaccountResponse,
    Error,
    SubmittedPayoutSave,
    PayoutSaveMutationContext
  >({
    mutationFn: ({ merchantId: submittedMerchantId, ...data }) => {
      return apiClient<CreateSubaccountResponse>('/api/paystack/subaccount', {
        method: 'POST',
        body: JSON.stringify({ ...data, merchantId: submittedMerchantId }),
      });
    },
    onMutate: ({ merchantId: submittedMerchantId }) => {
      const pendingSaveId = nextPendingSaveId.current;
      nextPendingSaveId.current += 1;
      setPendingPayoutSaves((pendingSaves) => [
        ...pendingSaves,
        { id: pendingSaveId, merchantId: submittedMerchantId },
      ]);

      return { merchantId: submittedMerchantId, id: pendingSaveId };
    },
    onSuccess: async (_data, _variables, context) => {
      if (!context) return;
      const invalidations: Promise<unknown>[] = [
        queryClient.invalidateQueries({ queryKey: ['merchant'] }),
        queryClient.invalidateQueries({ queryKey: ['merchant-payout'] }),
      ];
      invalidations.push(
        tryRefreshStoreReadiness(() =>
          invalidateStoreReadiness(queryClient, context.merchantId)
        )
      );
      await Promise.all(invalidations);
    },
    onSettled: (_data, _error, _variables, context) => {
      if (!context) return;
      setPendingPayoutSaves((pendingSaves) =>
        pendingSaves.filter((save) => save.id !== context.id)
      );
    },
  });

  const isSavingPayoutSettings = merchantId
    ? pendingPayoutSaves.some((save) => save.merchantId === merchantId)
    : false;

  const capturePayoutSave = (data: CreateSubaccountPayload) =>
    merchantId ? { ...data, merchantId } : null;

  const mapPayoutSaveOptions = (
    data: CreateSubaccountPayload,
    options:
      | MutateOptions<CreateSubaccountResponse, Error, CreateSubaccountPayload>
      | undefined
  ):
    | MutateOptions<
        CreateSubaccountResponse,
        Error,
        SubmittedPayoutSave,
        PayoutSaveMutationContext
      >
    | undefined => {
    if (!options) return undefined;

    return {
      ...options,
      onError: (error, _submitted, onMutateResult, context) =>
        options.onError?.(error, data, onMutateResult, context),
      onSettled: (response, error, _submitted, onMutateResult, context) =>
        options.onSettled?.(response, error, data, onMutateResult, context),
      onSuccess: (response, _submitted, onMutateResult, context) =>
        options.onSuccess?.(response, data, onMutateResult, context),
    };
  };

  const savePayoutSettings: PublicPayoutSaveMutation = {
    isPending: isSavingPayoutSettings,
    mutate: (data, options) => {
      const submittedSave = capturePayoutSave(data);
      if (!submittedSave) {
        options?.onError?.(
          new Error('Merchant not loaded. Please try again.'),
          data,
          undefined,
          { client: queryClient, meta: undefined }
        );
        return;
      }
      savePayoutSettingsMutation.mutate(
        submittedSave,
        mapPayoutSaveOptions(data, options)
      );
    },
    mutateAsync: (data) => {
      const submittedSave = capturePayoutSave(data);
      if (!submittedSave) {
        return Promise.reject(
          new Error('Merchant not loaded. Please try again.')
        );
      }
      return savePayoutSettingsMutation.mutateAsync(submittedSave);
    },
  };

  return {
    resolveAccount: resolveAccountMutation,
    savePayoutSettings,
  };
}
