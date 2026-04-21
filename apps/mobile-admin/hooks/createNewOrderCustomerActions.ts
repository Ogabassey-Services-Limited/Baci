import type { Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import type { CountryCode } from 'react-native-country-picker-modal';
import { createEmptyNewCustomerDraft } from '@/components/orders/new-order.defaults';
import {
  DEFAULT_COUNTRY_CODE,
  getCustomerDisplayName,
} from '@/components/orders/new-order.shared';
import type {
  CustomerInfo,
  NewCustomerDraft,
  SelectableCustomer,
} from '@/components/orders/new-order.types';
import { supabase } from '@/lib/supabase';

interface CreateNewOrderCustomerActionsParams {
  createCustomer: (input: {
    address?: string;
    email?: string;
    first_name: string;
    last_name: string;
    phone: string;
  }) => Promise<SelectableCustomer>;
  merchantId?: string;
  newCustomer: NewCustomerDraft;
  setCustomer: Dispatch<SetStateAction<CustomerInfo>>;
  setCustomerSearch: Dispatch<SetStateAction<string>>;
  setDuplicateCustomer: Dispatch<SetStateAction<SelectableCustomer | null>>;
  setIsCreatingCustomer: Dispatch<SetStateAction<boolean>>;
  setNewCustomer: Dispatch<SetStateAction<NewCustomerDraft>>;
  setSelectedCountryCode: Dispatch<SetStateAction<CountryCode>>;
  setShowCustomerModal: Dispatch<SetStateAction<boolean>>;
}

export function createNewOrderCustomerActions({
  createCustomer,
  merchantId,
  newCustomer,
  setCustomer,
  setCustomerSearch,
  setDuplicateCustomer,
  setIsCreatingCustomer,
  setNewCustomer,
  setSelectedCountryCode,
  setShowCustomerModal,
}: CreateNewOrderCustomerActionsParams) {
  const resetNewCustomerForm = () => {
    setNewCustomer(createEmptyNewCustomerDraft());
  };

  const handleCloseCustomerModal = () => {
    setShowCustomerModal(false);
    setIsCreatingCustomer(false);
    resetNewCustomerForm();
    setSelectedCountryCode(DEFAULT_COUNTRY_CODE);
    setDuplicateCustomer(null);
    setCustomerSearch('');
  };

  const handleSelectCustomer = (item: SelectableCustomer) => {
    setCustomer({
      address: item.address || '',
      email: item.email || '',
      id: item.id,
      name: getCustomerDisplayName(item),
      phone: item.phone || '',
    });
    setShowCustomerModal(false);
    setCustomerSearch('');
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.firstName || !newCustomer.phone) {
      Alert.alert('Required', 'First Name and Phone are required');
      return;
    }

    if (!merchantId) {
      Alert.alert(
        'Unavailable',
        'Merchant information is still loading. Please try again.'
      );
      return;
    }

    try {
      const duplicateChecks = [
        { column: 'phone' as const, value: newCustomer.phone.trim() },
        { column: 'email' as const, value: newCustomer.email.trim() },
      ];

      for (const { column, value } of duplicateChecks) {
        if (!value) {
          continue;
        }

        const { data: existingCustomer, error: searchError } = await supabase
          .from('customers')
          .select('id, first_name, last_name, email, phone, address')
          .eq('merchant_id', merchantId)
          .is('deleted_at', null)
          .eq(column, value)
          .maybeSingle();

        if (searchError) {
          console.error('Error checking for existing customer:', searchError);
          continue;
        }

        if (existingCustomer) {
          setDuplicateCustomer(existingCustomer);
          return;
        }
      }

      const customer = await createCustomer({
        address: newCustomer.address || undefined,
        email: newCustomer.email || undefined,
        first_name: newCustomer.firstName,
        last_name: newCustomer.lastName,
        phone: newCustomer.phone,
      });

      handleSelectCustomer(customer);
      setIsCreatingCustomer(false);
      resetNewCustomerForm();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to create customer right now.';
      Alert.alert('Error', message);
    }
  };

  return {
    handleCloseCustomerModal,
    handleCreateCustomer,
    handleSelectCustomer,
    resetNewCustomerForm,
  };
}
