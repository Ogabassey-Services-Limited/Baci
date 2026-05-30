import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import {
  getDefaultSavedAddress,
  type SavedAddress,
  toCheckoutAddressValues,
} from '@/lib/checkout-saved-address';
import { supabase } from '@/lib/supabase';
import type { ShippingAddressInput } from '@/lib/validation';
import { trackError } from '@/services/analytics';

interface UseCheckoutSavedAddressesParams {
  customerId?: string;
  hasInitialContactIdentity: boolean;
  isAuthenticated: boolean;
  merchantId: string;
  setCommittedAddress: (value: string) => void;
  setValue: UseFormSetValue<ShippingAddressInput>;
}

export function useCheckoutSavedAddresses({
  customerId,
  hasInitialContactIdentity,
  isAuthenticated,
  merchantId,
  setCommittedAddress,
  setValue,
}: UseCheckoutSavedAddressesParams) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<
    string | null
  >(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [isLoadingSavedAddresses, setIsLoadingSavedAddresses] = useState(false);
  const [isContactCollapsed, setIsContactCollapsed] = useState(false);
  const [isDeliveryCollapsed, setIsDeliveryCollapsed] = useState(false);
  const [saveAsDefaultAddress, setSaveAsDefaultAddress] = useState(false);
  const hasHydratedSavedAddressRef = useRef(false);
  const initialHasContactIdentityRef = useRef(hasInitialContactIdentity);
  const hasSavedAddresses = isAuthenticated && savedAddresses.length > 0;
  const selectedSavedAddress =
    savedAddresses.find((item) => item.id === selectedSavedAddressId) ?? null;
  const defaultSavedAddress = getDefaultSavedAddress(savedAddresses);

  const applySavedAddressToForm = (
    savedAddress: SavedAddress,
    options?: { collapse?: boolean }
  ) => {
    const checkoutValues = toCheckoutAddressValues(savedAddress);
    setValue('firstName', checkoutValues.firstName, { shouldValidate: true });
    setValue('lastName', checkoutValues.lastName, { shouldValidate: true });
    setValue('phone', checkoutValues.phone, { shouldValidate: true });
    setValue('address', checkoutValues.address, { shouldValidate: true });
    setValue('city', checkoutValues.city, { shouldValidate: true });
    setValue('state', checkoutValues.state, { shouldValidate: true });
    setCommittedAddress(checkoutValues.address);
    setSelectedSavedAddressId(savedAddress.id);
    setIsAddingNewAddress(false);
    setSaveAsDefaultAddress(Boolean(savedAddress.is_default));

    if (options?.collapse !== false) {
      setIsContactCollapsed(true);
      setIsDeliveryCollapsed(true);
    }
  };
  const hydrateSavedAddress = useEffectEvent((savedAddress: SavedAddress) => {
    applySavedAddressToForm(savedAddress, { collapse: true });
  });

  useEffect(() => {
    const fetchAndHydrate = async () => {
      if (!isAuthenticated || !customerId) {
        setSavedAddresses([]);
        setSelectedSavedAddressId(null);
        setIsAddingNewAddress(true);
        setIsLoadingSavedAddresses(false);
        setIsContactCollapsed(false);
        setIsDeliveryCollapsed(false);
        setSaveAsDefaultAddress(false);
        hasHydratedSavedAddressRef.current = false;
        return;
      }

      setIsLoadingSavedAddresses(true);
      const nextAddresses = await fetchSavedAddresses(customerId, merchantId);
      setSavedAddresses(nextAddresses);
      setIsLoadingSavedAddresses(false);

      if (hasHydratedSavedAddressRef.current) return;
      const defaultAddr = getDefaultSavedAddress(nextAddresses);
      if (!defaultAddr) {
        setIsContactCollapsed(initialHasContactIdentityRef.current);
        setIsDeliveryCollapsed(false);
        setIsAddingNewAddress(true);
        setSaveAsDefaultAddress(true);
        hasHydratedSavedAddressRef.current = true;
        return;
      }

      hydrateSavedAddress(defaultAddr);
      hasHydratedSavedAddressRef.current = true;
    };

    fetchAndHydrate();
  }, [customerId, isAuthenticated, merchantId, setValue]);

  useEffect(() => {
    if (!hasSavedAddresses) {
      setIsAddingNewAddress(true);
      return;
    }

    if (selectedSavedAddressId) {
      setIsAddingNewAddress(false);
    }
  }, [hasSavedAddresses, selectedSavedAddressId]);

  return {
    applySavedAddressToForm,
    defaultSavedAddress,
    hasSavedAddresses,
    isAddingNewAddress,
    isContactCollapsed,
    isDeliveryCollapsed,
    isLoadingSavedAddresses,
    openNewAddressEditor: () => {
      setSelectedSavedAddressId(null);
      setIsAddingNewAddress(true);
      setSaveAsDefaultAddress(savedAddresses.length <= 1);
    },
    saveAsDefaultAddress,
    savedAddresses,
    selectedSavedAddress,
    selectedSavedAddressId,
    setIsContactCollapsed,
    setIsDeliveryCollapsed,
    setSaveAsDefaultAddress,
  };
}

async function fetchSavedAddresses(
  customerId: string,
  merchantId: string
): Promise<SavedAddress[]> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('saved_addresses')
      .eq('id', customerId)
      .eq('merchant_id', merchantId)
      .single();

    if (error) throw error;
    const addresses = Array.isArray(data?.saved_addresses)
      ? ([...data.saved_addresses] as SavedAddress[])
      : [];

    addresses.sort(
      (left, right) =>
        Number(Boolean(right.is_default)) - Number(Boolean(left.is_default))
    );
    return addresses;
  } catch (error) {
    trackError(
      'checkout_saved_addresses_fetch',
      error instanceof Error ? error.message : 'Failed to load saved addresses'
    );
    return [];
  }
}
