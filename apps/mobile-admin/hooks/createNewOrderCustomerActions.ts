import type { Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import type { CountryCode } from 'react-native-country-picker-modal';
import { createEmptyNewCustomerDraft } from '@/components/orders/new-order.defaults';
import { DEFAULT_COUNTRY_CODE } from '@/components/orders/new-order.shared';
import type {
  CustomerInfo,
  NewCustomerDraft,
  SelectableCustomer,
} from '@/components/orders/new-order.types';
import { supabase } from '@/lib/supabase';

interface CreateNewOrderCustomerActionsParams {
  createCustomer: (input: {
    first_name: string;
    last_name: string;
    phone: string;
    email?: string;
    address?: string;
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
    const displayName =
      [item.first_name, item.last_name]
        .filter((name): name is string => Boolean(name))
        .join(' ') ||
      item.email?.split('@')[0] ||
      item.phone ||
      'Unknown';

    setCustomer({
      address: item.address || '',
      email: item.email || '',
      id: item.id,
      name: displayName,
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
      const conditions: string[] = [];
      if (newCustomer.phone) {
        conditions.push(`phone.eq.${newCustomer.phone}`);
      }
      if (newCustomer.email) {
        conditions.push(`email.eq.${newCustomer.email}`);
      }

      const { data: existingCustomers, error: searchError } = await supabase
        .from('customers')
        .select('id, first_name, last_name, email, phone, address')
        .eq('merchant_id', merchantId)
        .or(conditions.join(','))
        .limit(1);

      if (searchError) {
        Alert.alert(
          'Error',
          'Failed to check for existing customers. Please try again.'
        );
        return;
      }

      if (existingCustomers && existingCustomers.length > 0) {
        setDuplicateCustomer(existingCustomers[0]);
        return;
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
      Alert.alert('Error', (error as Error).message);
    }
  };

  return {
    handleCloseCustomerModal,
    handleCreateCustomer,
    handleSelectCustomer,
    resetNewCustomerForm,
  };
}
