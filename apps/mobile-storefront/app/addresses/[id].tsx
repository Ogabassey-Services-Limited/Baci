/**
 * Add/Edit Address Screen
 * Form for creating or updating delivery addresses
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

interface AddressForm {
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  is_default: boolean;
}

const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

const ADDRESS_LABELS = ['Home', 'Office', 'Other'];

export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNewAddress = id === 'new';
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const user = useAuthStore((state) => state.user);

  const [form, setForm] = useState<AddressForm>({
    label: 'Home',
    name: '',
    phone: '',
    address: '',
    city: '',
    state: 'Lagos',
    postal_code: '',
    is_default: false,
  });
  const [isLoading, setIsLoading] = useState(!isNewAddress);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<AddressForm>>({});

  useEffect(() => {
    if (!isNewAddress && id) {
      fetchAddress();
    }
  }, [id, isNewAddress]);

  const fetchAddress = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setForm({
          label: data.label || 'Home',
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || 'Lagos',
          postal_code: data.postal_code || '',
          is_default: data.is_default || false,
        });
      }
    } catch (err) {
      console.error('Error fetching address:', err);
      Alert.alert('Error', 'Failed to load address');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<AddressForm> = {};

    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!/^(\+234|0)[789]\d{9}$/.test(form.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Enter a valid Nigerian phone number';
    }
    if (!form.address.trim()) newErrors.address = 'Address is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.state) newErrors.state = 'State is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !user?.id) return;

    setIsSaving(true);

    try {
      // If setting as default, unset other defaults first
      if (form.is_default) {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', user.id);
      }

      if (isNewAddress) {
        const { error } = await supabase.from('customer_addresses').insert({
          customer_id: user.id,
          ...form,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('customer_addresses')
          .update(form)
          .eq('id', id);

        if (error) throw error;
      }

      router.back();
    } catch (err) {
      console.error('Error saving address:', err);
      Alert.alert('Error', 'Failed to save address');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof AddressForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Address Label */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Address Label</Text>
          <View style={styles.labelOptions}>
            {ADDRESS_LABELS.map((label) => (
              <TouchableOpacity
                key={label}
                style={[
                  styles.labelOption,
                  { borderColor: colors.border },
                  form.label === label && { borderColor: BRAND.primary, backgroundColor: `${BRAND.primary}10` },
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
                  color={form.label === label ? BRAND.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.labelOptionText,
                    { color: form.label === label ? BRAND.primary : colors.text },
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
          <Text style={[styles.label, { color: colors.text }]}>Full Name *</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, color: colors.text, borderColor: errors.name ? '#EF4444' : colors.border },
            ]}
            value={form.name}
            onChangeText={(value) => updateField('name', value)}
            placeholder="Enter full name"
            placeholderTextColor={colors.textSecondary}
          />
          {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Phone */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Phone Number *</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, color: colors.text, borderColor: errors.phone ? '#EF4444' : colors.border },
            ]}
            value={form.phone}
            onChangeText={(value) => updateField('phone', value)}
            placeholder="e.g. 08012345678"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
          {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Street Address *</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: colors.card, color: colors.text, borderColor: errors.address ? '#EF4444' : colors.border },
            ]}
            value={form.address}
            onChangeText={(value) => updateField('address', value)}
            placeholder="Enter street address"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
          />
          {errors.address && <Text style={styles.errorText}>{errors.address}</Text>}
        </View>

        {/* City */}
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>City *</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, color: colors.text, borderColor: errors.city ? '#EF4444' : colors.border },
            ]}
            value={form.city}
            onChangeText={(value) => updateField('city', value)}
            placeholder="Enter city"
            placeholderTextColor={colors.textSecondary}
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
                  form.state === state && { borderColor: BRAND.primary, backgroundColor: `${BRAND.primary}10` },
                ]}
                onPress={() => updateField('state', state)}
              >
                <Text
                  style={[
                    styles.stateChipText,
                    { color: form.state === state ? BRAND.primary : colors.text },
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
          <Text style={[styles.label, { color: colors.text }]}>Postal Code (Optional)</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
            ]}
            value={form.postal_code}
            onChangeText={(value) => updateField('postal_code', value)}
            placeholder="Enter postal code"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
          />
        </View>

        {/* Set as Default */}
        <TouchableOpacity
          style={[styles.defaultToggle, { backgroundColor: colors.card }]}
          onPress={() => updateField('is_default', !form.is_default)}
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
              <Text style={[styles.defaultToggleHint, { color: colors.textSecondary }]}>
                Use this address for all orders
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
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
    </KeyboardAvoidingView>
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
