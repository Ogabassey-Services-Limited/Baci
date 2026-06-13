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
import {
  fetchSavedAddress,
  persistAddress,
} from '@/components/addresses/mutate-saved-addresses';
import type { AddressFormData } from '@/components/addresses/types';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { useToast } from '@/components/ui/Toast';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { createLogger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('AddressForm');

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
  const [isFetchingAddress, setIsFetchingAddress] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<AddressFormData>>({});
  const navigateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived at render time: the screen can only fetch an existing address when
  // we have a real address id plus a fully initialized auth context. When this
  // is false (new address, stale deep link, partial auth) the spinner stays
  // off without a set-state-in-effect flipping it.
  const canFetchExistingAddress =
    !isNewAddress &&
    Boolean(id) &&
    Boolean(customer?.id) &&
    Boolean(merchantId);
  const isLoading = canFetchExistingAddress && isFetchingAddress;

  // Cleanup navigate timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (navigateTimeoutRef.current) {
        clearTimeout(navigateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isNewAddress) {
      return;
    }
    if (!canFetchExistingAddress || !id || !customer?.id || !merchantId) {
      // Stale deep link or partially initialized auth: the derived `isLoading`
      // already keeps the spinner off, so just surface the error and back out.
      Alert.alert('Error', 'Unable to load address. Please sign in again.');
      router.back();
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
        setIsFetchingAddress(false);
      });
  }, [id, isNewAddress, canFetchExistingAddress, customer?.id, merchantId]);

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
