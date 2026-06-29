import Ionicons from '@react-native-vector-icons/ionicons';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { StoreUrlSection } from './StoreUrlSection';

interface StoreSettingsDetailsCardProps {
  address: string;
  businessName: string;
  colors: ThemeColors;
  countryLabel: string;
  currency: string;
  email: string;
  onAddressChange: (text: string) => void;
  onBusinessNameChange: (text: string) => void;
  onEmailChange: (text: string) => void;
  onOpenCountryPicker: () => void;
  onPhoneChange: (text: string) => void;
  onSlugChange: (text: string) => void;
  onSupportPhoneChange: (text: string) => void;
  phone: string;
  shadowStyle: StyleProp<ViewStyle>;
  slugLocked: boolean;
  slug: string;
  supportPhone: string;
}

export function StoreSettingsDetailsCard({
  address,
  businessName,
  colors,
  countryLabel,
  currency,
  email,
  onAddressChange,
  onBusinessNameChange,
  onEmailChange,
  onOpenCountryPicker,
  onPhoneChange,
  onSlugChange,
  onSupportPhoneChange,
  phone,
  shadowStyle,
  slugLocked,
  slug,
  supportPhone,
}: StoreSettingsDetailsCardProps) {
  const sharedInputStyle: StyleProp<TextStyle> = [
    styles.input,
    {
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  return (
    <>
      <View
        style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Business Name
        </Text>
        <TextInput
          accessibilityLabel="Business Name"
          autoCapitalize="words"
          onChangeText={onBusinessNameChange}
          placeholder="Enter business name"
          placeholderTextColor={colors.textMuted}
          style={sharedInputStyle}
          value={businessName}
        />
      </View>

      <View
        style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Phone Number
        </Text>
        <TextInput
          accessibilityLabel="Phone Number"
          keyboardType="phone-pad"
          onChangeText={onPhoneChange}
          placeholder="Enter phone number"
          placeholderTextColor={colors.textMuted}
          style={sharedInputStyle}
          value={phone}
        />
      </View>

      <View
        style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Support Phone
        </Text>
        <TextInput
          accessibilityLabel="Support Phone"
          keyboardType="phone-pad"
          onChangeText={onSupportPhoneChange}
          placeholder="Enter support phone number"
          placeholderTextColor={colors.textMuted}
          style={sharedInputStyle}
          value={supportPhone}
        />
      </View>

      <View
        style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Support Email
        </Text>
        <TextInput
          accessibilityLabel="Support Email"
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={onEmailChange}
          placeholder="Enter support email"
          placeholderTextColor={colors.textMuted}
          style={sharedInputStyle}
          value={email}
        />
      </View>

      <View
        style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Business Address
        </Text>
        <TextInput
          accessibilityLabel="Business Address"
          multiline
          numberOfLines={3}
          onChangeText={onAddressChange}
          placeholder="Enter business address"
          placeholderTextColor={colors.textMuted}
          style={[sharedInputStyle, styles.multilineInput]}
          textAlignVertical="top"
          value={address}
        />
      </View>

      <View
        style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Region Settings
        </Text>
        <View style={styles.regionGroup}>
          <View>
            <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
              Country
            </Text>
            <Pressable
              accessibilityLabel="Select country"
              accessibilityRole="button"
              onPress={onOpenCountryPicker}
              style={[
                styles.readOnlyInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.text }}>{countryLabel}</Text>
              <Ionicons
                color={colors.textMuted}
                name="chevron-down"
                size={16}
              />
            </Pressable>
          </View>

          <View>
            <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
              Currency
            </Text>
            <View
              accessibilityLabel="Selected currency"
              accessibilityRole="text"
              style={[
                styles.readOnlyInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  opacity: 0.6,
                },
              ]}
            >
              <Text style={{ color: colors.text }}>{currency}</Text>
              <Ionicons color={colors.textMuted} name="lock-closed" size={14} />
            </View>
          </View>
        </View>
      </View>

      <StoreUrlSection
        colors={colors}
        onSlugChange={onSlugChange}
        shadowStyle={shadowStyle}
        slug={slug}
        slugLocked={slugLocked}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.sm,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    padding: SPACING.md,
  },
  multilineInput: {
    minHeight: 80,
  },
  regionGroup: {
    gap: SPACING.md,
  },
  sublabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.xs,
  },
  readOnlyInput: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
  },
});
