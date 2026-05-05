/**
 * Add/Edit Address Screen
 * Form for creating or updating delivery addresses
 * Addresses are stored as JSONB array in customers.saved_addresses
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppKeyboardAwareScrollView from '@/components/ui/AppKeyboardAwareScrollView';
import { useToast } from '@/components/ui/Toast';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { TextContentTypes } from '@/hooks/use-keyboard';
import { createLogger } from '@/lib/logger';
import { normalizeSavedAddresses } from '@/lib/saved-addresses';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('AddressForm');

// Matches web app's SavedAddress (stored as JSONB in customers.saved_addresses)
interface SavedAddress {
  id: string;
  label: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code?: string;
  is_default?: boolean;
}

interface AddressFormData {
  label: string;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  is_default: boolean;
}

const NIGERIA_STATES = [
  'Abia',
  'Adamawa',
  'Akwa Ibom',
  'Anambra',
  'Bauchi',
  'Bayelsa',
  'Benue',
  'Borno',
  'Cross River',
  'Delta',
  'Ebonyi',
  'Edo',
  'Ekiti',
  'Enugu',
  'FCT',
  'Gombe',
  'Imo',
  'Jigawa',
  'Kaduna',
  'Kano',
  'Katsina',
  'Kebbi',
  'Kogi',
  'Kwara',
  'Lagos',
  'Nasarawa',
  'Niger',
  'Ogun',
  'Ondo',
  'Osun',
  'Oyo',
  'Plateau',
  'Rivers',
  'Sokoto',
  'Taraba',
  'Yobe',
  'Zamfara',
];

const ADDRESS_LABELS = ['Home', 'Office', 'Other'];

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
    if (!isNewAddress && id && customer?.id && merchantId) {
      const fetchAddress = async () => {
        try {
          // Fetch saved_addresses JSONB from customers table
          const { data, error } = await supabase
            .from('customers')
            .select('saved_addresses')
            .eq('id', customer.id)
            .eq('merchant_id', merchantId)
            .single();

          if (error) throw error;

          // Find the address by ID in the JSONB array
          const addresses = Array.isArray(data?.saved_addresses)
            ? (data.saved_addresses as SavedAddress[])
            : [];
          const found = addresses.find((a) => a.id === id);

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
        } catch (err) {
          log.error('Error fetching address:', err);
          Alert.alert('Error', 'Failed to load address');
          router.back();
        } finally {
          setIsLoading(false);
        }
      };
      fetchAddress();
    }
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

  const handleSave = async () => {
    // 2026 Best Practice: Dismiss keyboard on submit
    Keyboard.dismiss();

    if (!validateForm() || !customer?.id || !merchantId) return;

    setIsSaving(true);

    try {
      // Fetch current saved_addresses array
      const { data, error: fetchError } = await supabase
        .from('customers')
        .select('saved_addresses')
        .eq('id', customer.id)
        .eq('merchant_id', merchantId)
        .single();

      if (fetchError) throw fetchError;

      let addresses: SavedAddress[] = Array.isArray(data?.saved_addresses)
        ? (data.saved_addresses as SavedAddress[])
        : [];

      const addressEntry: SavedAddress = {
        id: isNewAddress ? `addr_${Date.now()}` : id,
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
        addresses = addresses.map((a) => (a.id === id ? addressEntry : a));
      }

      addresses = normalizeSavedAddresses(addresses);

      // Write updated array back
      const { error: updateError } = await supabase
        .from('customers')
        .update({ saved_addresses: addresses })
        .eq('id', customer.id)
        .eq('merchant_id', merchantId);

      if (updateError) throw updateError;

      toast.success(
        isNewAddress
          ? 'Address added successfully'
          : 'Address saved successfully'
      );

      // Small delay to let the toast show before navigating back
      navigateTimeoutRef.current = setTimeout(() => router.back(), 500);
    } catch (err) {
      log.error('Error saving address:', err);
      Alert.alert('Error', 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
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
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppKeyboardAwareScrollView
        bottomOffset={100}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        {/* Address Label */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Address Label
          </Text>
          <View style={styles.labelOptions}>
            {ADDRESS_LABELS.map((label) => (
              <TouchableOpacity
                key={label}
                style={[
                  styles.labelOption,
                  { borderColor: colors.border },
                  form.label === label && {
                    borderColor: BRAND.primary,
                    backgroundColor: `${BRAND.primary}10`,
                  },
                ]}
                onPress={() => updateField('label', label)}
              >
                <Ionicons
                  name={
                    label === 'Home'
                      ? 'home-outline'
                      : label === 'Office'
                        ? 'business-outline'
                        : 'location-outline'
                  }
                  size={18}
                  color={
                    form.label === label ? BRAND.primary : colors.textSecondary
                  }
                />
                <Text
                  style={[
                    styles.labelOptionText,
                    {
                      color: form.label === label ? BRAND.primary : colors.text,
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Full Name *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.text,
                borderColor: errors.full_name ? colors.error : colors.border,
              },
            ]}
            value={form.full_name}
            onChangeText={(value) => updateField('full_name', value)}
            placeholder="Enter full name"
            placeholderTextColor={colors.placeholder}
            textContentType={TextContentTypes.name}
            autoComplete="name"
            returnKeyType="next"
          />
          {errors.full_name && (
            <Text style={styles.errorText}>{errors.full_name}</Text>
          )}
        </View>

        {/* Phone */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Phone Number *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.text,
                borderColor: errors.phone ? colors.error : colors.border,
              },
            ]}
            value={form.phone}
            onChangeText={(value) => updateField('phone', value)}
            placeholder="e.g. 08012345678"
            placeholderTextColor={colors.placeholder}
            keyboardType="phone-pad"
            textContentType={TextContentTypes.telephoneNumber}
            autoComplete="tel"
            returnKeyType="next"
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Street Address *
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: colors.muted,
                color: colors.text,
                borderColor: errors.address ? colors.error : colors.border,
              },
            ]}
            value={form.address}
            onChangeText={(value) => updateField('address', value)}
            placeholder="Enter street address"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={3}
            textContentType={TextContentTypes.fullStreetAddress}
            autoComplete="street-address"
          />
          {errors.address && (
            <Text style={styles.errorText}>{errors.address}</Text>
          )}
        </View>

        {/* City */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>City *</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.text,
                borderColor: errors.city ? colors.error : colors.border,
              },
            ]}
            value={form.city}
            onChangeText={(value) => updateField('city', value)}
            placeholder="Enter city"
            placeholderTextColor={colors.placeholder}
            textContentType={TextContentTypes.addressCity}
            autoComplete="postal-address-locality"
            returnKeyType="next"
          />
          {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
        </View>

        {/* State */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>State *</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statesContainer}
          >
            {NIGERIA_STATES.map((state) => (
              <TouchableOpacity
                key={state}
                style={[
                  styles.stateChip,
                  { borderColor: colors.border },
                  form.state === state && {
                    borderColor: BRAND.primary,
                    backgroundColor: `${BRAND.primary}10`,
                  },
                ]}
                onPress={() => updateField('state', state)}
              >
                <Text
                  style={[
                    styles.stateChipText,
                    {
                      color: form.state === state ? BRAND.primary : colors.text,
                    },
                  ]}
                >
                  {state}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Postal Code */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>
            Postal Code (Optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            value={form.postal_code}
            onChangeText={(value) => updateField('postal_code', value)}
            placeholder="Enter postal code"
            placeholderTextColor={colors.placeholder}
            keyboardType="number-pad"
          />
        </View>

        {/* Set as Default */}
        <TouchableOpacity
          style={[styles.defaultToggle, { backgroundColor: colors.muted }]}
          onPress={() => updateField('is_default', !form.is_default)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: form.is_default }}
          accessibilityLabel="Set as default address"
          accessibilityHint="Use this address for all orders"
        >
          <View style={styles.defaultToggleContent}>
            <Ionicons
              name={form.is_default ? 'checkbox' : 'square-outline'}
              size={24}
              color={form.is_default ? BRAND.primary : colors.textSecondary}
            />
            <View>
              <Text style={[styles.defaultToggleText, { color: colors.text }]}>
                Set as default address
              </Text>
              <Text
                style={[
                  styles.defaultToggleHint,
                  { color: colors.textSecondary },
                ]}
              >
                Use this address for all orders
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </AppKeyboardAwareScrollView>

      {/* Save Button */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: BRAND.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isNewAddress ? 'Add Address' : 'Save Changes'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 2026 Best Practice: Toast feedback component */}
      <toast.Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  labelOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  labelOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  statesContainer: {
    gap: 8,
    paddingVertical: 4,
  },
  stateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  stateChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  defaultToggle: {
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  defaultToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  defaultToggleText: {
    fontSize: 15,
    fontWeight: '500',
  },
  defaultToggleHint: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
