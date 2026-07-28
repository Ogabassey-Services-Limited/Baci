import Ionicons from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CountryPickerModal } from '@/components/ui/CountryPickerModal';
import type { BusinessTypeId } from '@/constants/business-types';
import { COUNTRIES } from '@/constants/countries';
import { useTheme } from '@/hooks/useTheme';
import { BusinessTypeSelector } from '../BusinessTypeSelector';
import { RegisterLegalText } from './RegisterLegalText';
import { getStyles } from './register.styles';

interface RegisterFormData {
  businessName: string;
  businessType: string;
  country: string;
  otherBusinessType: string;
  slug: string;
}

interface RegisterBusinessStepProps {
  formData: RegisterFormData;
  isLoading: boolean;
  onBusinessTypeChange: (typeId: BusinessTypeId) => void;
  onCountryChange: (countryCode: string) => void;
  onLaunchStore: () => void;
  onOtherBusinessTypeChange: (text: string) => void;
  onBusinessNameChange: (text: string) => void;
  onSlugChange: (text: string) => void;
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s'’-])\S/g, (match) => match.toUpperCase());
}

export function RegisterBusinessStep({
  formData,
  isLoading,
  onBusinessNameChange,
  onBusinessTypeChange,
  onCountryChange,
  onLaunchStore,
  onOtherBusinessTypeChange,
  onSlugChange,
}: RegisterBusinessStepProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [isCountryPickerVisible, setIsCountryPickerVisible] = useState(false);
  const selectedCountry = COUNTRIES.find(
    (country) => country.code === formData.country
  );
  const selectedCountryName = selectedCountry?.name ?? 'Select country';

  return (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Business Info</Text>
      <Text style={styles.sectionValidation}>Tell us about your store</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Name</Text>
        <TextInput
          accessibilityLabel="Business Name"
          style={styles.input}
          placeholder="My Awesome Store"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          value={formData.businessName}
          onChangeText={(text) => onBusinessNameChange(toTitleCase(text))}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Store Link</Text>
        <View style={styles.urlInputContainer}>
          <TextInput
            accessibilityLabel="Store Link"
            style={[styles.urlInput, { textAlign: 'right' }]}
            placeholder="my-store"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            value={formData.slug}
            onChangeText={onSlugChange}
          />
          <Text style={styles.urlSuffix}>.usebaci.com</Text>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Business Type</Text>
        <BusinessTypeSelector
          borderColor={colors.border}
          cardBackgroundColor={colors.card}
          onSelect={onBusinessTypeChange}
          selectedBackgroundColor={colors.primary}
          selectedBorderColor={colors.primary}
          selectedTextColor={colors.textOnPrimary}
          selectedType={formData.businessType}
          textColor={colors.textSecondary}
        />
      </View>

      {formData.businessType === 'other' ? (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Please specify</Text>
          <TextInput
            accessibilityLabel="Please specify"
            style={styles.input}
            placeholder="e.g. Pet Supplies"
            placeholderTextColor={colors.textMuted}
            value={formData.otherBusinessType}
            onChangeText={onOtherBusinessTypeChange}
          />
        </View>
      ) : null}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Country / Region</Text>
        <View style={styles.countrySelector}>
          <Pressable
            accessibilityLabel={`Country / Region, ${selectedCountryName}`}
            accessibilityRole="button"
            onPress={() => setIsCountryPickerVisible(true)}
            style={styles.countrySelectorPressable}
          >
            <Text style={styles.countrySelectorText}>{selectedCountryName}</Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          isLoading && { opacity: 0.7 },
          pressed && !isLoading && { opacity: 0.7 },
        ]}
        onPress={onLaunchStore}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={isLoading ? 'Launching store...' : 'Launch Store'}
        accessibilityState={{ disabled: isLoading, busy: isLoading }}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <>
            <Text style={styles.buttonText}>Launch Store</Text>
            <Ionicons
              name="rocket-outline"
              size={20}
              color={colors.textOnPrimary}
            />
          </>
        )}
      </Pressable>

      <RegisterLegalText prefixText="By creating an account, you agree to our" />

      {isCountryPickerVisible ? (
        <CountryPickerModal
          onClose={() => setIsCountryPickerVisible(false)}
          onSelect={(country) => {
            onCountryChange(country.code);
            setIsCountryPickerVisible(false);
          }}
          selectedCountry={formData.country}
          visible={true}
        />
      ) : null}
    </View>
  );
}
