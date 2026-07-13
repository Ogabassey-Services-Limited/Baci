import { useState } from 'react';
import type { CountryCode } from 'react-native-country-picker-modal';
import { createEmptyNewCustomerDraft } from '@/components/orders/new-order.defaults';
import { DEFAULT_COUNTRY_CODE } from '@/components/orders/new-order.shared';
import type { SelectableCustomer } from '@/components/orders/new-order.types';

/**
 * Customer-draft state for the new order flow: the search box, the
 * in-progress "create new customer" form, and the duplicate-detection
 * result. Sibling to useNewOrderUiState/useNewOrderVatState.
 */
export function useNewOrderCustomerDraftState() {
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState(createEmptyNewCustomerDraft);
  const [selectedCountryCode, setSelectedCountryCode] =
    useState<CountryCode>(DEFAULT_COUNTRY_CODE);
  const [duplicateCustomer, setDuplicateCustomer] =
    useState<SelectableCustomer | null>(null);

  return {
    customerSearch,
    duplicateCustomer,
    isCreatingCustomer,
    newCustomer,
    selectedCountryCode,
    setCustomerSearch,
    setDuplicateCustomer,
    setIsCreatingCustomer,
    setNewCustomer,
    setSelectedCountryCode,
  };
}
