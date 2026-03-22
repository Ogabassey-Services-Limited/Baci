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
import { Text, TextInput, View } from 'react-native';
import { Controller } from 'react-hook-form';
import { palette } from '@/constants/Colors';
import type { EmailInputProps, SignInFormData } from '../types';
import { styles } from '../styles';

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
}: EmailInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel} nativeID="email-label">
        Email Address
      </Text>
      <Controller<SignInFormData>
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[
              styles.input,
              errors.email && {
                borderColor: '#DC2626',
                borderWidth: 1.5,
              },
            ]}
            placeholder="name@example.com"
            placeholderTextColor={palette.gray[400]}
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
            color: '#DC2626',
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
