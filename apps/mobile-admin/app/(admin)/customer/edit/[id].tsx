import { splitCustomerFullName } from '@baci/shared';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { ContactInfoForm } from '@/components/customer-edit/ContactInfoForm';
import { customerEditStyles as styles } from '@/components/customer-edit/customer-edit.styles';
import type { InputStyleOptions } from '@/components/customer-edit/customer-edit.types';
import { LocationForm } from '@/components/customer-edit/LocationForm';
import { PersonalDetailsForm } from '@/components/customer-edit/PersonalDetailsForm';
import { ProfileHeader } from '@/components/customer-edit/ProfileHeader';
import { SaveBar } from '@/components/customer-edit/SaveBar';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useCustomer, useUpdateCustomer } from '@/hooks/useCustomers';
import { useTheme } from '@/hooks/useTheme';
import {
  isValidEmail,
  sanitizeAddress,
  sanitizeCustomerName,
  sanitizeEmail,
  sanitizePhone,
} from '@/lib/sanitize';

export default function CustomerEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const { data: customer, isLoading } = useCustomer(id || '');
  const updateCustomer = useUpdateCustomer();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneModified, setPhoneModified] = useState(false);
  const [address, setAddress] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;

    const fallbackNames = splitCustomerFullName(customer.full_name);
    const fName = customer.first_name ?? fallbackNames.first_name;
    const lName = customer.last_name ?? fallbackNames.last_name;

    setFirstName(fName ?? '');
    setLastName(lName ?? '');
    setEmail(customer.email ?? '');
    setPhone(formatPhoneForInput(customer.phone ?? ''));
    setAddress(customer.address ?? '');
    setPhoneModified(false);
  }, [customer]);

  const handleSave = async () => {
    if (!isValidEmail(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    try {
      await updateCustomer.mutateAsync({
        id: id || '',
        first_name: sanitizeCustomerName(firstName.trim()) || null,
        last_name: sanitizeCustomerName(lastName.trim()) || null,
        email: sanitizeEmail(email.trim()),
        phone: phoneModified
          ? sanitizePhone(phone.trim()) || null
          : customer?.phone || null,
        address: sanitizeAddress(address.trim()) || null,
      });
      Alert.alert('Success', 'Customer updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (_error) {
      Alert.alert('Error', 'Failed to update customer');
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Stack.Screen
          options={{ title: 'Loading...', headerBackTitle: 'Cancel' }}
        />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <AppFormScreen
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Edit Customer',
          headerBackTitle: 'Cancel',
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={updateCustomer.isPending}
              style={{ padding: SPACING.sm }}
            >
              {updateCustomer.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
                  }}
                >
                  Save
                </Text>
              )}
            </Pressable>
          ),
        }}
      />

      <ProfileHeader
        colors={colors}
        email={email}
        initials={getInitials(firstName, lastName)}
        name={`${firstName} ${lastName}`.trim()}
      />
      <PersonalDetailsForm
        colors={colors}
        firstName={firstName}
        inputStyle={(fieldName) =>
          createInputStyle(fieldName, focusedField, colors)
        }
        lastName={lastName}
        onFirstNameChange={setFirstName}
        onFocusField={setFocusedField}
        onLastNameChange={setLastName}
        shadows={shadows}
      />
      <ContactInfoForm
        colors={colors}
        customerId={customer?.id}
        email={email}
        inputStyle={(fieldName) =>
          createInputStyle(fieldName, focusedField, colors)
        }
        isDark={isDark}
        onEmailChange={setEmail}
        onFocusField={setFocusedField}
        onPhoneChange={(value) => {
          setPhone(value);
          setPhoneModified(true);
        }}
        phone={phone}
        shadows={shadows}
      />
      <LocationForm
        address={address}
        colors={colors}
        inputStyle={(fieldName) =>
          createInputStyle(fieldName, focusedField, colors)
        }
        onAddressChange={setAddress}
        onFocusField={setFocusedField}
        shadows={shadows}
      />
      <SaveBar
        colors={colors}
        isSaving={updateCustomer.isPending}
        onSave={handleSave}
        shadows={shadows}
      />
    </AppFormScreen>
  );
}

function createInputStyle(
  fieldName: string,
  focusedField: string | null,
  colors: ReturnType<typeof useTheme>['colors']
): InputStyleOptions {
  const state = {
    backgroundColor:
      focusedField === fieldName ? colors.background : colors.backgroundLight,
    borderColor: focusedField === fieldName ? colors.primary : colors.border,
    color: colors.text,
    shadowColor: colors.primary,
    shadowOpacity: focusedField === fieldName ? 0.1 : 0,
  };

  return {
    input: [styles.input, state],
    label: [styles.label, { color: colors.textSecondary }],
    state,
  };
}

function formatPhoneForInput(phoneNumber: string) {
  let phone = phoneNumber;
  if (phone.startsWith('+234')) {
    phone = phone.slice(4);
  } else if (phone.startsWith('234')) {
    phone = phone.slice(3);
  }
  if (phone.startsWith('0')) {
    phone = phone.slice(1);
  }
  return phone;
}

function getInitials(firstName: string, lastName: string) {
  const first = firstName[0] || '';
  const last = lastName[0] || '';
  return (first + last).toUpperCase() || '?';
}
