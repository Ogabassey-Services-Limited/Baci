import { NIGERIAN_STATES } from '@baci/shared';
import {
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  type Dispatch,
  type SetStateAction,
  useLayoutEffect,
  useRef,
} from 'react';
import { Alert } from 'react-native';
import { updateMerchantSettings } from '@/lib/merchant-settings';

interface UseTaxMutationsOptions {
  city: string;
  merchantId?: string | null;
  postalCode: string;
  setVatEnabled: Dispatch<SetStateAction<boolean>>;
  stateCode: string;
  street: string;
}

interface MerchantMutationContext {
  submittedMerchantId: string | null;
  submittedMerchantRevision: number;
}

interface MerchantMutationSnapshot<T> extends MerchantMutationContext {
  value: T;
}

interface PendingMerchantMutation {
  isPending: boolean;
  variables?: MerchantMutationContext;
}

interface MerchantScope {
  merchantId: string | null;
  revision: number;
}

type MerchantSettingsPayload = Parameters<typeof updateMerchantSettings>[1];

interface PublicMerchantMutation<TData, TValue> {
  isPending: boolean;
  mutate: (value: TValue) => void;
  mutateAsync: (value: TValue) => Promise<TData>;
}

export function useTaxMutations({
  city,
  merchantId,
  postalCode,
  setVatEnabled,
  stateCode,
  street,
}: UseTaxMutationsOptions) {
  const queryClient = useQueryClient();
  const activeMerchantId = merchantId?.trim() || null;
  const activeMerchantScopeRef = useRef<MerchantScope>({
    merchantId: activeMerchantId,
    revision: 0,
  });

  // Keep the ref aligned with the committed tenant. Mutating it while React is
  // rendering would let a suspended/abandoned merchant switch suppress the
  // completion UI for the merchant that remains on screen.
  useLayoutEffect(() => {
    if (activeMerchantScopeRef.current.merchantId === activeMerchantId) return;
    activeMerchantScopeRef.current = {
      merchantId: activeMerchantId,
      revision: activeMerchantScopeRef.current.revision + 1,
    };
  }, [activeMerchantId]);

  const isCurrentMerchant = (
    context: MerchantMutationContext | undefined
  ): boolean =>
    context !== undefined &&
    context.submittedMerchantId === activeMerchantScopeRef.current.merchantId &&
    context.submittedMerchantRevision ===
      activeMerchantScopeRef.current.revision;

  const invalidateSubmittedMerchantContext = (
    context: MerchantMutationContext | undefined
  ) => {
    if (!context?.submittedMerchantId) return;
    queryClient.invalidateQueries({ queryKey: ['merchant'] });
  };

  const isPendingForCurrentMerchant = ({
    isPending,
    variables,
  }: PendingMerchantMutation): boolean =>
    isPending &&
    variables?.submittedMerchantId === activeMerchantId &&
    variables?.submittedMerchantRevision ===
      activeMerchantScopeRef.current.revision;

  const updateSettings = (
    submittedMerchantId: string | null,
    payload: MerchantSettingsPayload
  ) => {
    if (!submittedMerchantId) throw new Error('No merchant found');
    return updateMerchantSettings(submittedMerchantId, payload);
  };

  const updateVatMutationInternal = useMutation({
    mutationFn: async ({
      submittedMerchantId,
      value: enabled,
    }: MerchantMutationSnapshot<boolean>) => {
      await updateSettings(submittedMerchantId, {
        vat_registration_status: enabled ? 'registered' : 'not_registered',
      });
      return enabled;
    },
    onMutate: ({
      submittedMerchantId,
      submittedMerchantRevision,
      value: enabled,
    }) => {
      setVatEnabled(enabled);
      return { submittedMerchantId, submittedMerchantRevision };
    },
    onSuccess: (enabled, _variables, context) => {
      invalidateSubmittedMerchantContext(context);
      if (!isCurrentMerchant(context)) return;
      Alert.alert(
        'Success',
        enabled
          ? 'VAT has been enabled. 7.5% VAT will be applied to all orders.'
          : 'VAT has been disabled.'
      );
    },
    onError: (_error, { value: enabled }, context) => {
      if (!isCurrentMerchant(context)) return;
      setVatEnabled(!enabled);
      Alert.alert('Error', 'Failed to update VAT settings. Please try again.');
    },
  });

  const saveTinMutationInternal = useMutation({
    mutationFn: async ({
      submittedMerchantId,
      value: tin,
    }: MerchantMutationSnapshot<string>) => {
      if (tin && !/^\d{10}$/.test(tin)) {
        throw new Error('Nigerian TIN must be exactly 10 digits');
      }

      await updateSettings(submittedMerchantId, {
        tax_identification_number: tin || null,
      });
    },
    onMutate: ({ submittedMerchantId, submittedMerchantRevision }) => ({
      submittedMerchantId,
      submittedMerchantRevision,
    }),
    onSuccess: (_data, _variables, context) => {
      invalidateSubmittedMerchantContext(context);
      if (!isCurrentMerchant(context)) return;
      Alert.alert('Success', 'Tax Identification Number saved.');
    },
    onError: (error: Error, _variables, context) => {
      if (!isCurrentMerchant(context)) return;
      Alert.alert('Error', error.message);
    },
  });

  const saveLegalEntityMutationInternal = useMutation({
    mutationFn: async ({
      submittedMerchantId,
      value: name,
    }: MerchantMutationSnapshot<string>) => {
      await updateSettings(submittedMerchantId, {
        legal_entity_name: name || null,
      });
    },
    onMutate: ({ submittedMerchantId, submittedMerchantRevision }) => ({
      submittedMerchantId,
      submittedMerchantRevision,
    }),
    onSuccess: (_data, _variables, context) => {
      invalidateSubmittedMerchantContext(context);
      if (!isCurrentMerchant(context)) return;
      Alert.alert('Success', 'Legal entity name saved.');
    },
    onError: (_error, _variables, context) => {
      if (!isCurrentMerchant(context)) return;
      Alert.alert('Error', 'Failed to save legal entity name.');
    },
  });

  const saveAddressMutationInternal = useMutation({
    mutationFn: async ({
      submittedMerchantId,
      value: payload,
    }: MerchantMutationSnapshot<MerchantSettingsPayload>) => {
      await updateSettings(submittedMerchantId, payload);
    },
    onMutate: ({ submittedMerchantId, submittedMerchantRevision }) => ({
      submittedMerchantId,
      submittedMerchantRevision,
    }),
    onSuccess: (_data, _variables, context) => {
      invalidateSubmittedMerchantContext(context);
      if (!isCurrentMerchant(context)) return;
      Alert.alert('Success', 'Registered business address saved.');
    },
    onError: (_error, _variables, context) => {
      if (!isCurrentMerchant(context)) return;
      Alert.alert('Error', 'Failed to save address. Please try again.');
    },
  });

  const captureSnapshot = <T>(value: T): MerchantMutationSnapshot<T> => {
    const scope = activeMerchantScopeRef.current;
    return {
      submittedMerchantId: scope.merchantId,
      submittedMerchantRevision: scope.revision,
      value,
    };
  };
  const captureAddressSnapshot = () => {
    const selectedState = NIGERIAN_STATES.find(
      (state) => state.code === stateCode
    );
    return captureSnapshot<MerchantSettingsPayload>({
      registered_address: {
        street: street || null,
        city: city || null,
        state: selectedState?.name || null,
        postal_code: postalCode || null,
        country: 'Nigeria',
      },
      state_code: stateCode || null,
    });
  };

  function createPublicMutation<TValue, TMutationValue, TData>(
    mutation: UseMutationResult<
      TData,
      Error,
      MerchantMutationSnapshot<TMutationValue>,
      MerchantMutationContext
    >,
    createSnapshot: (value: TValue) => MerchantMutationSnapshot<TMutationValue>
  ): PublicMerchantMutation<TData, TValue> {
    const captureActiveSnapshot = (value: TValue) => {
      const snapshot = createSnapshot(value);
      if (!snapshot.submittedMerchantId) return null;
      return snapshot;
    };

    return {
      isPending: isPendingForCurrentMerchant(mutation),
      mutate: (value: TValue) => {
        const snapshot = captureActiveSnapshot(value);
        if (!snapshot) return;
        mutation.mutate(snapshot);
      },
      mutateAsync: (value: TValue) => {
        const snapshot = captureActiveSnapshot(value);
        if (!snapshot) return Promise.reject(new Error('No merchant found'));
        return mutation.mutateAsync(snapshot);
      },
    };
  }

  const updateVatMutation = createPublicMutation<boolean, boolean, boolean>(
    updateVatMutationInternal,
    captureSnapshot
  );
  const saveTinMutation = createPublicMutation<string, string, void>(
    saveTinMutationInternal,
    captureSnapshot
  );
  const saveLegalEntityMutation = createPublicMutation<string, string, void>(
    saveLegalEntityMutationInternal,
    captureSnapshot
  );
  const saveAddressMutation = createPublicMutation<
    void,
    MerchantSettingsPayload,
    void
  >(saveAddressMutationInternal, () => captureAddressSnapshot());

  return {
    saveAddressMutation,
    saveLegalEntityMutation,
    saveTinMutation,
    updateVatMutation,
  };
}
