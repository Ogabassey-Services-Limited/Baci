import Ionicons from '@react-native-vector-icons/ionicons';
import { useRef } from 'react';
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

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

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
            autoComplete="given-name"
            textContentType="givenName"
            value={formData.firstName}
            onChangeText={(text) => updateForm('firstName', text)}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => lastNameRef.current?.focus()}
          />
        </View>
        <View style={styles.nameInputGroup}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            ref={lastNameRef}
            accessibilityLabel="Last Name"
            style={styles.input}
            placeholder="Doe"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            value={formData.lastName}
            onChangeText={(text) => updateForm('lastName', text)}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          ref={emailRef}
          accessibilityLabel="Email Address"
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          value={formData.email}
          onChangeText={(text) => updateForm('email', text)}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            ref={passwordRef}
            accessibilityLabel="Password"
            style={styles.passwordInput}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            // Both password fields declare newPassword so iOS drives its
            // create-account AutoFill flow deterministically instead of
            // guessing from two adjacent secure fields — the guess is what
            // leaves the fields stuck under the yellow AutoFill highlight.
            // passwordRules keeps a generated password past validatePassword's
            // "complexity" rule, which needs 10+ characters.
            autoComplete="password-new"
            textContentType="newPassword"
            passwordRules="minlength: 10;"
            value={formData.password}
            onChangeText={(text) => updateForm('password', text)}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
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
            ref={confirmPasswordRef}
            accessibilityLabel="Confirm Password"
            style={styles.passwordInput}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            autoComplete="password-new"
            textContentType="newPassword"
            passwordRules="minlength: 10;"
            value={formData.confirmPassword}
            onChangeText={(text) => updateForm('confirmPassword', text)}
            returnKeyType="done"
            onSubmitEditing={onNext}
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
