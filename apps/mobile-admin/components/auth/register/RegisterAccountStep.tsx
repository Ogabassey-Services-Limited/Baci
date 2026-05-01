import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { PasswordValidationResult } from '@/lib/password-utils';
import { PasswordVisibilityToggle } from '../PasswordVisibilityToggle';
import { PasswordChecklist } from './PasswordChecklist';
import { getStyles } from './register.styles';

interface RegisterFormData {
  confirmPassword: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

interface RegisterAccountStepProps {
  confirmError: string | null;
  formData: RegisterFormData;
  onNext: () => void;
  passwordState: PasswordValidationResult;
  showPassword: boolean;
  updateForm: <K extends keyof RegisterFormData>(
    key: K,
    value: RegisterFormData[K]
  ) => void;
  onTogglePassword: () => void;
}

export function RegisterAccountStep({
  confirmError,
  formData,
  onNext,
  passwordState,
  showPassword,
  updateForm,
  onTogglePassword,
}: RegisterAccountStepProps) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  return (
    <View style={styles.formSection}>
      <Text style={styles.sectionTitle}>Account Details</Text>
      <Text style={styles.sectionValidation}>Required</Text>

      <View style={styles.nameRow}>
        <View style={styles.nameInputGroup}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            accessibilityLabel="First Name"
            style={styles.input}
            placeholder="John"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            value={formData.firstName}
            onChangeText={(text) => updateForm('firstName', text)}
          />
        </View>
        <View style={styles.nameInputGroup}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            accessibilityLabel="Last Name"
            style={styles.input}
            placeholder="Doe"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            value={formData.lastName}
            onChangeText={(text) => updateForm('lastName', text)}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          accessibilityLabel="Email Address"
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={formData.email}
          onChangeText={(text) => updateForm('email', text)}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            accessibilityLabel="Password"
            style={styles.passwordInput}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            value={formData.password}
            onChangeText={(text) => updateForm('password', text)}
          />
          <PasswordVisibilityToggle
            accessibilityLabel={
              showPassword ? 'Hide password' : 'Show password'
            }
            iconColor={colors.textSecondary}
            iconName={showPassword ? 'eye-off' : 'eye'}
            onPress={onTogglePassword}
          />
        </View>

        <PasswordChecklist
          passwordState={passwordState}
          passwordValue={formData.password}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirm Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            accessibilityLabel="Confirm Password"
            style={styles.passwordInput}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            value={formData.confirmPassword}
            onChangeText={(text) => updateForm('confirmPassword', text)}
          />
          <PasswordVisibilityToggle
            accessibilityLabel={
              showPassword ? 'Hide password' : 'Show password'
            }
            iconColor={colors.textSecondary}
            iconName={showPassword ? 'eye-off' : 'eye'}
            onPress={onTogglePassword}
          />
        </View>
        {confirmError ? (
          <Text style={styles.errorText}>{confirmError}</Text>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel="Proceed to next step"
      >
        <Text style={styles.buttonText}>Next Step</Text>
        <Ionicons name="arrow-forward" size={20} color={colors.textOnPrimary} />
      </Pressable>
    </View>
  );
}
