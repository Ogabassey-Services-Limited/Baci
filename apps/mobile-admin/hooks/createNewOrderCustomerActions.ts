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
import {
  sanitizeAddress,
  sanitizeCustomerName,
  sanitizeEmail,
  sanitizePhone,
} from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';

interface CreateNewOrderCustomerActionsParams {
  createCustomer: (input: {
    address?: string;
    company_name?: string;
    customer_type: 'individual' | 'company';
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

function normalizeNewCustomerDraft(newCustomer: NewCustomerDraft) {
  return {
    address: newCustomer.address ? sanitizeAddress(newCustomer.address) : '',
    companyName: sanitizeCustomerName(newCustomer.companyName),
    customerType: newCustomer.customerType,
    email: newCustomer.email ? sanitizeEmail(newCustomer.email) : '',
    firstName: sanitizeCustomerName(newCustomer.firstName),
    lastName: sanitizeCustomerName(newCustomer.lastName),
    phone: newCustomer.phone ? sanitizePhone(newCustomer.phone) : '',
  };
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
    const normalizedCustomer = normalizeNewCustomerDraft(newCustomer);
    const isCompany = normalizedCustomer.customerType === 'company';

    if (isCompany) {
      if (!normalizedCustomer.companyName || !normalizedCustomer.phone) {
        Alert.alert('Required', 'Company Name and Phone are required');
        return;
      }
    } else if (!normalizedCustomer.firstName || !normalizedCustomer.phone) {
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
        {
          column: 'phone' as const,
          match: 'eq' as const,
          value: normalizedCustomer.phone,
        },
        {
          column: 'email' as const,
          match: 'ilike' as const,
          value: normalizedCustomer.email,
        },
      ];

      for (const { column, match, value } of duplicateChecks) {
        if (!value) {
          continue;
        }

        let query = supabase
          .from('customers')
          .select(
            'id, customer_type, company_name, full_name, first_name, last_name, email, phone, address'
          )
          .eq('merchant_id', merchantId)
          .is('deleted_at', null);

        query =
          match === 'ilike'
            ? query.ilike(column, value)
            : query.eq(column, value);

        const { data: existingCustomer, error: searchError } =
          await query.limit(1);

        if (searchError) {
          Alert.alert(
            'Error',
            'Unable to check for existing customers right now.'
          );
          return;
        }

        const firstMatch = existingCustomer?.[0] ?? null;

        if (firstMatch) {
          setDuplicateCustomer(firstMatch);
          return;
        }
      }

      const customer = await createCustomer({
        address: normalizedCustomer.address || undefined,
        company_name: isCompany
          ? normalizedCustomer.companyName || undefined
          : undefined,
        customer_type: normalizedCustomer.customerType,
        email: normalizedCustomer.email || undefined,
        first_name: isCompany ? '' : normalizedCustomer.firstName,
        last_name: isCompany ? '' : normalizedCustomer.lastName,
        phone: normalizedCustomer.phone,
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
