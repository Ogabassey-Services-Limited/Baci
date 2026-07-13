/**
 * EmailInput Component
 *
 * 2026 Best Practices:
 * - React Hook Form Controller integration
 * - Full accessibility support
 * - Proper keyboard and autocomplete settings
 * - Clean, reusable input component
 */

import React from 'react';
import { Controller } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';
import type { CheckoutIdentityTheme } from '../colors';
import { styles } from '../styles';
import type { EmailInputProps, SignInFormData } from '../types';

interface ThemedEmailInputProps extends EmailInputProps {
  theme: CheckoutIdentityTheme;
}

/**
 * Email input with label and React Hook Form integration
 */
export function EmailInput({
  control,
  errors,
  isLoading,
  onClearError,
  returnKeyType,
  onSubmitEditing,
  theme,
}: ThemedEmailInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text
        style={[styles.inputLabel, { color: theme.mutedText }]}
        nativeID="email-label"
      >
        Email Address
      </Text>
      <Controller<SignInFormData>
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.input,
                borderColor: theme.border,
                color: theme.text,
              },
              errors.email && {
                borderColor: theme.error,
                borderWidth: 1.5,
              },
            ]}
            placeholder="name@example.com"
            placeholderTextColor={theme.placeholder}
            value={value}
            onChangeText={(text) => {
              onChange(text);
              onClearError?.();
            }}
            onBlur={onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            textContentType="emailAddress"
            accessibilityLabel="Email address"
            accessibilityLabelledBy="email-label"
            accessibilityHint="Enter your account email"
            editable={!isLoading}
            returnKeyType={returnKeyType}
            blurOnSubmit={false}
            onSubmitEditing={onSubmitEditing}
          />
        )}
      />
      {errors.email && (
        <Text
          style={{
            fontSize: 12,
            color: theme.error,
            marginTop: 4,
          }}
          accessibilityRole="alert"
        >
          {errors.email.message}
        </Text>
      )}
    </View>
  );
}
