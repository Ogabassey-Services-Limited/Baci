import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BusinessTypeId } from '@/constants/business-types';
import { DARK_COLORS } from '@/constants/theme';
import { BusinessTypeSelector } from '../BusinessTypeSelector';
import { RegisterLegalText } from './RegisterLegalText';
import { registerStyles as styles } from './register.styles';

interface RegisterFormData {
  businessName: string;
  businessType: string;
  otherBusinessType: string;
  slug: string;
}

interface RegisterBusinessStepProps {
  formData: RegisterFormData;
  isLoading: boolean;
  onBusinessTypeChange: (typeId: BusinessTypeId) => void;
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
  onLaunchStore,
  onOtherBusinessTypeChange,
  onSlugChange,
}: RegisterBusinessStepProps) {
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
          placeholderTextColor="#6B7280"
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
            placeholderTextColor="#6B7280"
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
          borderColor={DARK_COLORS.border}
          cardBackgroundColor="rgba(255,255,255,0.05)"
          onSelect={onBusinessTypeChange}
          selectedBackgroundColor={DARK_COLORS.primary}
          selectedBorderColor={DARK_COLORS.primary}
          selectedTextColor="#FFF"
          selectedType={formData.businessType}
          textColor="#9CA3AF"
        />
      </View>

      {formData.businessType === 'other' ? (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Please specify</Text>
          <TextInput
            accessibilityLabel="Please specify"
            style={styles.input}
            placeholder="e.g. Pet Supplies"
            placeholderTextColor="#6B7280"
            value={formData.otherBusinessType}
            onChangeText={onOtherBusinessTypeChange}
          />
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.button,
          isLoading && { opacity: 0.7 },
          pressed && !isLoading && { opacity: 0.7 }
        ]}
        onPress={onLaunchStore}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Text style={styles.buttonText}>Launch Store</Text>
            <Ionicons name="rocket-outline" size={20} color="#FFF" />
          </>
        )}
      </Pressable>

      <RegisterLegalText prefixText="By creating an account, you agree to our" />
    </View>
  );
}
