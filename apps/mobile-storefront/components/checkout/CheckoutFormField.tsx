import React from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
} from 'react-hook-form';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { BRAND } from '@/constants/Colors';
import type { ShippingAddressInput } from '@/lib/validation';
import {
  CHECKOUT_FIELD_AUTO_COMPLETE,
  CHECKOUT_FIELD_TEXT_CONTENT_TYPES,
} from './checkout-form-field.helpers';

type CheckoutFormFieldColors = {
  background: string;
  border: string;
  error: string;
  muted: string;
  placeholder: string;
  text: string;
  textSecondary: string;
};

type CheckoutFormFieldProps = {
  name: keyof ShippingAddressInput;
  label: string;
  placeholder: string;
  control: Control<ShippingAddressInput>;
  errors: FieldErrors<ShippingAddressInput>;
  colors: CheckoutFormFieldColors;
  isDark: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  multiline?: boolean;
  containerStyle?: ViewStyle;
  returnKeyType?: 'next' | 'done' | 'go';
  onSubmitEditing?: () => void;
  transformText?: (value: string, previous: string) => string;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

export function CheckoutFormField({
  name,
  label,
  placeholder,
  control,
  errors,
  colors,
  isDark,
  keyboardType = 'default',
  multiline = false,
  containerStyle,
  returnKeyType = 'next',
  onSubmitEditing,
  transformText,
  maxLength,
  autoCapitalize,
}: CheckoutFormFieldProps) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={[styles.inputGroup, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => {
          const stringValue = typeof value === 'string' ? value : '';

          return (
            <TextInput
              accessibilityHint={`Enter your ${label}`}
              accessibilityLabel={label}
              autoCapitalize={autoCapitalize}
              autoComplete={CHECKOUT_FIELD_AUTO_COMPLETE[name]}
              blurOnSubmit={!multiline}
              keyboardType={keyboardType}
              maxLength={maxLength}
              multiline={multiline}
              numberOfLines={multiline ? 2 : 1}
              onBlur={() => {
                setIsFocused(false);
                onBlur();
              }}
              onChangeText={(text) => {
                const processed = transformText
                  ? transformText(text, stringValue)
                  : text;
                onChange(processed);
              }}
              onFocus={() => setIsFocused(true)}
              onSubmitEditing={onSubmitEditing}
              placeholder={placeholder}
              placeholderTextColor={colors.placeholder}
              returnKeyType={multiline ? 'default' : returnKeyType}
              style={[
                styles.input,
                multiline && styles.multilineInput,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : colors.muted,
                  borderColor: errors[name]
                    ? colors.error
                    : isFocused
                      ? BRAND.primary
                      : colors.border,
                  color: colors.text,
                },
              ]}
              textContentType={CHECKOUT_FIELD_TEXT_CONTENT_TYPES[name]}
              value={stringValue}
            />
          );
        }}
      />
      {errors[name] ? (
        <Text
          style={[styles.fieldError, { color: colors.error }]}
          accessibilityLiveRegion="polite"
        >
          {errors[name]?.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldError: {
    alignItems: 'center',
    flexDirection: 'row',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
  },
  input: {
    borderColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
