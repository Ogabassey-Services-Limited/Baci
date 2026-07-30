import { NIGERIAN_STATES } from '@baci/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Dispatch, SetStateAction } from 'react';
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

export function useTaxMutations({
  city,
  merchantId,
  postalCode,
  setVatEnabled,
  stateCode,
  street,
}: UseTaxMutationsOptions) {
  const queryClient = useQueryClient();

  const updateSettings = (
    payload: Parameters<typeof updateMerchantSettings>[1]
  ) => {
    if (!merchantId) throw new Error('No merchant found');
    return updateMerchantSettings(merchantId, payload);
  };

  const updateVatMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await updateSettings({
        vat_registration_status: enabled ? 'registered' : 'not_registered',
      });
      return enabled;
    },
    onMutate: (enabled) => {
      setVatEnabled(enabled);
    },
    onSuccess: (enabled) => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      Alert.alert(
        'Success',
        enabled
          ? 'VAT has been enabled. 7.5% VAT will be applied to all orders.'
          : 'VAT has been disabled.'
      );
    },
    onError: (_error, enabled) => {
      setVatEnabled(!enabled);
      Alert.alert('Error', 'Failed to update VAT settings. Please try again.');
    },
  });

  const saveTinMutation = useMutation({
    mutationFn: async (tin: string) => {
      if (tin && !/^\d{10}$/.test(tin)) {
        throw new Error('Nigerian TIN must be exactly 10 digits');
      }

      await updateSettings({
        tax_identification_number: tin || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      Alert.alert('Success', 'Tax Identification Number saved.');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const saveLegalEntityMutation = useMutation({
    mutationFn: async (name: string) => {
      await updateSettings({
        legal_entity_name: name || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      Alert.alert('Success', 'Legal entity name saved.');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save legal entity name.');
    },
  });

  const saveAddressMutation = useMutation({
    mutationFn: async () => {
      const selectedState = NIGERIAN_STATES.find(
        (state) => state.code === stateCode
      );

      await updateSettings({
        registered_address: {
          street: street || null,
          city: city || null,
          state: selectedState?.name || null,
          postal_code: postalCode || null,
          country: 'Nigeria',
        },
        state_code: stateCode || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      Alert.alert('Success', 'Registered business address saved.');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save address. Please try again.');
    },
  });

  return {
    saveAddressMutation,
    saveLegalEntityMutation,
    saveTinMutation,
    updateVatMutation,
  };
}
