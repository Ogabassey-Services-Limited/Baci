/**
 * Add/Edit Address Screen
 * Form for creating or updating delivery addresses
 * Addresses are stored as JSONB array in customers.saved_addresses
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AddressFormFields } from '@/components/addresses/AddressFormFields';
import { addressFormStyles as styles } from '@/components/addresses/address-form.styles';
import type { Address, AddressFormData } from '@/components/addresses/types';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { useToast } from '@/components/ui/Toast';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { createLogger } from '@/lib/logger';
import { normalizeSavedAddresses } from '@/lib/saved-addresses';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('AddressForm');

// Module-scope helpers own try/throw/finally — those statements in the
// component body block React Compiler memoization.
async function fetchSavedAddress(
  customerId: string,
  merchantId: string,
  addressId: string
): Promise<Address | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('saved_addresses')
    .eq('id', customerId)
    .eq('merchant_id', merchantId)
    .single();

  if (error) throw error;

  const addresses = Array.isArray(data?.saved_addresses)
    ? (data.saved_addresses as Address[])
    : [];
  return addresses.find((a) => a.id === addressId) ?? null;
}

async function persistAddress(params: {
  addressId: string;
  customerId: string;
  form: AddressFormData;
  isNewAddress: boolean;
  merchantId: string;
}): Promise<void> {
  const { addressId, customerId, form, isNewAddress, merchantId } = params;

  // Fetch current saved_addresses array
  const { data, error: fetchError } = await supabase
    .from('customers')
    .select('saved_addresses')
    .eq('id', customerId)
    .eq('merchant_id', merchantId)
    .single();

  if (fetchError) throw fetchError;

  let addresses: Address[] = Array.isArray(data?.saved_addresses)
    ? (data.saved_addresses as Address[])
    : [];

  const addressEntry: Address = {
    id: isNewAddress ? `addr_${Date.now()}` : addressId,
    label: form.label,
    full_name: form.full_name,
    phone: form.phone,
    address: form.address,
    city: form.city,
    state: form.state,
    country: 'Nigeria',
    postal_code: form.postal_code || undefined,
    is_default: form.is_default,
  };

  // If setting as default, clear other defaults
  if (form.is_default) {
    addresses = addresses.map((a) => ({ ...a, is_default: false }));
  }

  if (isNewAddress) {
    addresses.push(addressEntry);
  } else {
    addresses = addresses.map((a) => (a.id === addressId ? addressEntry : a));
  }

  addresses = normalizeSavedAddresses(addresses);

  // Write updated array back
  const { error: updateError } = await supabase
    .from('customers')
    .update({ saved_addresses: addresses })
    .eq('id', customerId)
    .eq('merchant_id', merchantId);

  if (updateError) throw updateError;
}

export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNewAddress = id === 'new';
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const customer = useAuthStore((state) => state.customer);
  const merchantId = useAuthStore((state) => state.merchantId);

  // 2026 Best Practice: Toast feedback for address save
  const toast = useToast();

  const [form, setForm] = useState<AddressFormData>({
    label: 'Home',
    full_name: '',
    phone: '',
    address: '',
    city: '',
    state: 'Lagos',
    postal_code: '',
    is_default: false,
  });
  const [isLoading, setIsLoading] = useState(!isNewAddress);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<AddressFormData>>({});
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup navigate timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isNewAddress || !id || !customer?.id || !merchantId) {
      return;
    }
    // Promise chain keeps try/finally out of the component body.
    fetchSavedAddress(customer.id, merchantId, id)
      .then((found) => {
        if (found) {
          setForm({
            label: found.label ?? 'Home',
            full_name: found.full_name ?? '',
            phone: found.phone ?? '',
            address: found.address ?? '',
            city: found.city ?? '',
            state: found.state ?? 'Lagos',
            postal_code: found.postal_code ?? '',
            is_default: found.is_default ?? false,
          });
        } else {
          Alert.alert('Error', 'Address not found');
          router.back();
        }
      })
      .catch((err) => {
        log.error('Error fetching address:', err);
        Alert.alert('Error', 'Failed to load address');
        router.back();
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id, isNewAddress, customer?.id, merchantId]);

  const validateForm = (): boolean => {
    const newErrors: Partial<AddressFormData> = {};

    if (!form.full_name.trim()) newErrors.full_name = 'Name is required';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!/^(\+234|234|0)[7-9]\d{9}$/.test(form.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Enter a valid Nigerian phone number';
    }
    if (!form.address.trim()) newErrors.address = 'Address is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.state) newErrors.state = 'State is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    // 2026 Best Practice: Dismiss keyboard on submit
    Keyboard.dismiss();

    if (!validateForm() || !customer?.id || !merchantId) return;

    setIsSaving(true);

    // Promise chain keeps try/finally out of the component body.
    persistAddress({
      addressId: id,
      customerId: customer.id,
      form,
      isNewAddress,
      merchantId,
    })
      .then(() => {
        toast.success(
          isNewAddress
            ? 'Address added successfully'
            : 'Address saved successfully'
        );

        // Small delay to let the toast show before navigating back
        navigateTimeoutRef.current = setTimeout(() => router.back(), 500);
      })
      .catch((err) => {
        log.error('Error saving address:', err);
        Alert.alert('Error', 'Failed to save address');
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const updateField = (
    field: keyof AddressFormData,
    value: string | boolean
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AppKeyboardContainer
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <AddressFormFields
        colors={colors}
        errors={errors}
        form={form}
        onUpdateField={updateField}
      />

      {/* Save Button */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={isNewAddress ? 'Add Address' : 'Save Changes'}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text
              style={[
                styles.saveButtonText,
                { color: colors.primaryForeground },
              ]}
            >
              {isNewAddress ? 'Add Address' : 'Save Changes'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 2026 Best Practice: Toast feedback component */}
      <toast.Toast />
    </AppKeyboardContainer>
  );
}
