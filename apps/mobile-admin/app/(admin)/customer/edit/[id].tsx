import { splitCustomerFullName } from '@baci/shared';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import PhoneInput from 'react-native-phone-number-input';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
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
    if (customer) {
      const fallbackNames = splitCustomerFullName(customer.full_name);
      const fName = customer.first_name ?? fallbackNames.first_name;
      const lName = customer.last_name ?? fallbackNames.last_name;

      setFirstName(fName ?? '');
      setLastName(lName ?? '');
      setEmail(customer.email ?? '');

      // Format phone for PhoneInput: strip leading 0 or +234 prefix
      let phoneNum = customer.phone ?? '';
      if (phoneNum.startsWith('+234')) {
        phoneNum = phoneNum.slice(4); // Remove +234
      } else if (phoneNum.startsWith('234')) {
        phoneNum = phoneNum.slice(3); // Remove 234
      }
      if (phoneNum.startsWith('0')) {
        phoneNum = phoneNum.slice(1); // Remove leading 0
      }
      setPhone(phoneNum);

      setAddress(customer.address ?? '');
    }
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

  const getInitials = () => {
    const first = firstName[0] || '';
    const last = lastName[0] || '';
    return (first + last).toUpperCase() || '?';
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

  const getInputStyle = (fieldName: string) => [
    styles.input,
    {
      backgroundColor:
        focusedField === fieldName ? colors.background : colors.backgroundLight,
      borderColor: focusedField === fieldName ? colors.primary : colors.border,
      color: colors.text,
      shadowColor: colors.primary,
      shadowOpacity: focusedField === fieldName ? 0.1 : 0,
    },
  ];

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

      {/* Profile Header */}
      <Animated.View
        entering={FadeIn.duration(600)}
        style={styles.profileHeader}
      >
        <View
          style={[styles.avatarOuter, { backgroundColor: colors.primaryLight }]}
        >
          <View
            style={[styles.avatarInner, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
        </View>
        <Text style={[styles.headerName, { color: colors.text }]}>
          {firstName} {lastName}
        </Text>
        <Text style={[styles.headerSubtext, { color: colors.textSecondary }]}>
          {email}
        </Text>
      </Animated.View>

      {/* Personal Info Section */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(500)}
        style={[styles.section, { backgroundColor: colors.card }, shadows.sm]}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Personal Details
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            First Name
          </Text>
          <TextInput
            style={getInputStyle('firstName')}
            value={firstName}
            onChangeText={setFirstName}
            onFocus={() => setFocusedField('firstName')}
            onBlur={() => setFocusedField(null)}
            placeholder="First Name"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Last Name
          </Text>
          <TextInput
            style={getInputStyle('lastName')}
            value={lastName}
            onChangeText={setLastName}
            onFocus={() => setFocusedField('lastName')}
            onBlur={() => setFocusedField(null)}
            placeholder="Last Name"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </Animated.View>

      {/* Contact Info Section */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(500)}
        style={[styles.section, { backgroundColor: colors.card }, shadows.sm]}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="call-outline" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Contact Info
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Email Address *
          </Text>
          <TextInput
            style={getInputStyle('email')}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Phone Number
          </Text>
          <PhoneInput
            key={`phone-${customer?.id}-${phone}`}
            defaultValue={phone}
            defaultCode="NG"
            layout="first"
            onChangeFormattedText={(text) => {
              setPhone(text);
              setPhoneModified(true);
            }}
            containerStyle={[
              styles.phoneContainer,
              {
                backgroundColor:
                  focusedField === 'phone'
                    ? colors.background
                    : colors.backgroundLight,
                borderColor:
                  focusedField === 'phone' ? colors.primary : colors.border,
              },
            ]}
            textContainerStyle={styles.phoneTextContainer}
            textInputStyle={[styles.phoneTextInput, { color: colors.text }]}
            codeTextStyle={[styles.phoneCodeText, { color: colors.text }]}
            withDarkTheme={isDark}
            withShadow={false}
            textInputProps={{
              onFocus: () => setFocusedField('phone'),
              onBlur: () => setFocusedField(null),
              placeholderTextColor: colors.textMuted,
            }}
          />
        </View>
      </Animated.View>

      {/* Address Section */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(500)}
        style={[styles.section, { backgroundColor: colors.card }, shadows.sm]}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Location
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Shipping Address
          </Text>
          <TextInput
            style={[...getInputStyle('address'), styles.textArea]}
            value={address}
            onChangeText={setAddress}
            onFocus={() => setFocusedField('address')}
            onBlur={() => setFocusedField(null)}
            placeholder="Street address, City, State"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </View>
      </Animated.View>

      <Animated.View
        entering={FadeInUp.delay(500).duration(500)}
        style={styles.buttonContainer}
      >
        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            shadows.md,
          ]}
          onPress={handleSave}
          disabled={updateCustomer.isPending}
        >
          {updateCustomer.isPending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </Pressable>
      </Animated.View>
    </AppFormScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: SPACING['3xl'],
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
    paddingHorizontal: SPACING.lg,
  },
  avatarOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 5,
    marginBottom: SPACING.md,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#FFFFFF',
  },
  headerName: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  headerSubtext: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  section: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  input: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  saveButton: {
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  phoneContainer: {
    width: '100%',
    height: 58,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  phoneTextContainer: {
    backgroundColor: 'transparent',
  },
  phoneTextInput: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    height: 54,
  },
  phoneCodeText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  phoneFlagButton: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.05)',
  },
});
