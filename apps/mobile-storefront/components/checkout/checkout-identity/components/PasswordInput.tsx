/**
 * PasswordInput Component
 *
 * 2026 Best Practices:
 * - React Hook Form Controller integration
 * - Password visibility toggle
 * - Forgot password link
 * - Full accessibility support
 */

import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Controller } from 'react-hook-form';
import { palette } from '@/constants/Colors';
import type { PasswordInputProps, SignInFormData } from '../types';
import { styles } from '../styles';

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
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <View style={styles.inputLabelRow}>
        <Text style={styles.inputLabel} nativeID="password-label">
          Password
        </Text>
        <Pressable
          onPress={onForgotPassword}
          accessibilityRole="link"
          accessibilityLabel="Forgot password"
          accessibilityHint="Navigate to password reset"
          disabled={isLoading}
        >
          <Text style={styles.forgotLink}>Forgot password?</Text>
        </Pressable>
      </View>
      <View
        style={[
          styles.passwordContainer,
          errors.password && {
            borderColor: '#DC2626',
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
              style={styles.passwordInput}
              placeholder="Enter password"
              placeholderTextColor={palette.gray[400]}
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
          <Text style={styles.showPasswordText}>
            {showPassword ? 'Hide' : 'Show'}
          </Text>
        </Pressable>
      </View>
      {errors.password && (
        <Text
          style={{
            fontSize: 12,
            color: '#DC2626',
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
