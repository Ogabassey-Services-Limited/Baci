import Ionicons from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
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
          value={formData.businessName}
          onChangeText={onBusinessNameChange}
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

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Country/Region</Text>
        <View style={styles.countryOptions}>
          {COUNTRIES.map((country) => {
            const isSelected = formData.country === country.code;
            return (
              <Pressable
                accessibilityLabel={`Country ${country.name}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={country.code}
                onPress={() => onCountryChange(country.code)}
                style={[
                  styles.countryOption,
                  isSelected && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countryOptionText,
                    isSelected && { color: colors.textOnPrimary },
                  ]}
                >
                  {country.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
    </View>
  );
}
