import Ionicons from '@react-native-vector-icons/ionicons';
import {
  Pressable,
  type StyleProp,
  Text,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import type { CountryCode } from 'react-native-country-picker-modal';
import { COUNTRIES } from '@/constants/countries';
import type { ThemeColors } from '@/constants/theme';
import { StoreSettingsAddressField } from './StoreSettingsAddressField';
import { storeSettingsDetailsStyles as styles } from './StoreSettingsDetailsCard.styles';
import { StoreSettingsPhoneField } from './StoreSettingsPhoneField';
import { StoreUrlSection } from './StoreUrlSection';

function isSupportedCountryCode(code: string): code is CountryCode {
  return COUNTRIES.some((country) => country.code === code);
}

function resolvePhoneCountryCode(country: string): CountryCode {
  const normalizedCode = country.trim().toUpperCase();
  if (isSupportedCountryCode(normalizedCode)) {
    return normalizedCode;
  }

  const normalizedName = country.trim().toLocaleLowerCase();
  const matchingCountry = COUNTRIES.find(
    (candidate) => candidate.name.toLocaleLowerCase() === normalizedName
  );

  return matchingCountry && isSupportedCountryCode(matchingCountry.code)
    ? matchingCountry.code
    : 'NG';
}

interface StoreSettingsDetailsCardProps {
  address: string;
  businessName: string;
  colors: ThemeColors;
  countryCode: string;
  countryLabel: string;
  currency: string;
  email: string;
  googleMapsApiKey: string | undefined;
  isDark: boolean;
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
  countryCode,
  countryLabel,
  currency,
  email,
  googleMapsApiKey,
  isDark,
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
  const phoneCountryCode = resolvePhoneCountryCode(countryCode);
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

      <StoreSettingsPhoneField
        accessibilityLabel="Phone Number"
        colors={colors}
        countryCode={phoneCountryCode}
        isDark={isDark}
        label="Phone Number"
        onChange={onPhoneChange}
        placeholder="Enter phone number"
        shadowStyle={shadowStyle}
        value={phone}
      />

      <StoreSettingsPhoneField
        accessibilityLabel="Support Phone"
        colors={colors}
        countryCode={phoneCountryCode}
        isDark={isDark}
        label="Support Phone"
        onChange={onSupportPhoneChange}
        placeholder="Enter support phone number"
        shadowStyle={shadowStyle}
        value={supportPhone}
      />

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

      <StoreSettingsAddressField
        address={address}
        colors={colors}
        countryCode={phoneCountryCode}
        googleMapsApiKey={googleMapsApiKey}
        onAddressChange={onAddressChange}
        shadowStyle={shadowStyle}
      />

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
