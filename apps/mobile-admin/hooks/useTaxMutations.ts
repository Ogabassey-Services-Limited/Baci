import { NIGERIAN_STATES } from '@baci/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type Dispatch, type SetStateAction, useRef } from 'react';
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
}

interface MerchantMutationSnapshot<T> extends MerchantMutationContext {
  value: T;
}

type MerchantSettingsPayload = Parameters<typeof updateMerchantSettings>[1];

export function useTaxMutations({
  city,
  merchantId,
  postalCode,
  setVatEnabled,
  stateCode,
  street,
}: UseTaxMutationsOptions) {
  const queryClient = useQueryClient();
  const activeMerchantIdRef = useRef(merchantId ?? null);
  activeMerchantIdRef.current = merchantId ?? null;

  const isCurrentMerchant = (
    context: MerchantMutationContext | undefined
  ): boolean =>
    context !== undefined &&
    context.submittedMerchantId === activeMerchantIdRef.current;

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
    onMutate: ({ submittedMerchantId, value: enabled }) => {
      setVatEnabled(enabled);
      return { submittedMerchantId };
    },
    onSuccess: (enabled, _variables, context) => {
      if (!isCurrentMerchant(context)) return;
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
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
    onMutate: ({ submittedMerchantId }) => ({ submittedMerchantId }),
    onSuccess: (_data, _variables, context) => {
      if (!isCurrentMerchant(context)) return;
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
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
    onMutate: ({ submittedMerchantId }) => ({ submittedMerchantId }),
    onSuccess: (_data, _variables, context) => {
      if (!isCurrentMerchant(context)) return;
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
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
    onMutate: ({ submittedMerchantId }) => ({ submittedMerchantId }),
    onSuccess: (_data, _variables, context) => {
      if (!isCurrentMerchant(context)) return;
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      Alert.alert('Success', 'Registered business address saved.');
    },
    onError: (_error, _variables, context) => {
      if (!isCurrentMerchant(context)) return;
      Alert.alert('Error', 'Failed to save address. Please try again.');
    },
  });

  const captureSnapshot = <T>(value: T): MerchantMutationSnapshot<T> => ({
    submittedMerchantId: activeMerchantIdRef.current,
    value,
  });
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

  const updateVatMutation = {
    ...updateVatMutationInternal,
    mutate: (enabled: boolean) =>
      updateVatMutationInternal.mutate(captureSnapshot(enabled)),
    mutateAsync: (enabled: boolean) =>
      updateVatMutationInternal.mutateAsync(captureSnapshot(enabled)),
  };
  const saveTinMutation = {
    ...saveTinMutationInternal,
    mutate: (tin: string) =>
      saveTinMutationInternal.mutate(captureSnapshot(tin)),
    mutateAsync: (tin: string) =>
      saveTinMutationInternal.mutateAsync(captureSnapshot(tin)),
  };
  const saveLegalEntityMutation = {
    ...saveLegalEntityMutationInternal,
    mutate: (name: string) =>
      saveLegalEntityMutationInternal.mutate(captureSnapshot(name)),
    mutateAsync: (name: string) =>
      saveLegalEntityMutationInternal.mutateAsync(captureSnapshot(name)),
  };
  const saveAddressMutation = {
    ...saveAddressMutationInternal,
    mutate: () => saveAddressMutationInternal.mutate(captureAddressSnapshot()),
    mutateAsync: () =>
      saveAddressMutationInternal.mutateAsync(captureAddressSnapshot()),
  };

  return {
    saveAddressMutation,
    saveLegalEntityMutation,
    saveTinMutation,
    updateVatMutation,
  };
}
