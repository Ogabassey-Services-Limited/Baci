/**
 * PasswordInput Component
 *
 * 2026 Best Practices:
 * - React Hook Form Controller integration
 * - Password visibility toggle
 * - Forgot password link
 * - Full accessibility support
 */

import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { CheckoutIdentityTheme } from '../colors';
import { styles } from '../styles';
import type { PasswordInputProps, SignInFormData } from '../types';

interface ThemedPasswordInputProps extends PasswordInputProps {
  theme: CheckoutIdentityTheme;
}

/**
 * Password input with visibility toggle and forgot link
 */
export function PasswordInput({
  control,
  errors,
  isLoading,
  onClearError,
  onForgotPassword,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  theme,
}: ThemedPasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <View style={styles.inputLabelRow}>
        <Text
          style={[styles.inputLabel, { color: theme.mutedText }]}
          nativeID="password-label"
        >
          Password
        </Text>
        <Pressable
          onPress={onForgotPassword}
          accessibilityRole="link"
          accessibilityLabel="Forgot password"
          accessibilityHint="Navigate to password reset"
          disabled={isLoading}
        >
          <Text style={[styles.forgotLink, { color: theme.primary }]}>
            Forgot password?
          </Text>
        </Pressable>
      </View>
      <View
        style={[
          styles.passwordContainer,
          { backgroundColor: theme.input, borderColor: theme.border },
          errors.password && {
            borderColor: theme.error,
            borderWidth: 1.5,
          },
        ]}
      >
        <Controller<SignInFormData>
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              ref={inputRef}
              style={[styles.passwordInput, { color: theme.text }]}
              placeholder="Enter password"
              placeholderTextColor={theme.placeholder}
              value={value}
              onChangeText={(text) => {
                onChange(text);
                onClearError?.();
              }}
              onBlur={onBlur}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              textContentType="password"
              accessibilityLabel="Password"
              accessibilityLabelledBy="password-label"
              accessibilityHint={
                showPassword ? 'Password is visible' : 'Password is hidden'
              }
              editable={!isLoading}
              returnKeyType={returnKeyType}
              onSubmitEditing={onSubmitEditing}
            />
          )}
        />
        <Pressable
          style={styles.showPasswordButton}
          onPress={() => setShowPassword(!showPassword)}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          accessibilityHint="Toggle password visibility"
          disabled={isLoading}
        >
          <Text style={[styles.showPasswordText, { color: theme.mutedText }]}>
            {showPassword ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
      </View>
      {errors.password && (
        <Text
          style={{
            fontSize: 12,
            color: theme.error,
            marginTop: 4,
          }}
          accessibilityRole="alert"
        >
          {errors.password.message}
        </Text>
      )}
    </View>
  );
}
