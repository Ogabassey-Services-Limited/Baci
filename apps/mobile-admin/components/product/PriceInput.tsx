import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  View,
} from 'react-native';

interface PriceInputColors {
  border: string;
  inputBg: string;
  text: string;
  textSecondary: string;
}

interface PriceInputProps {
  accessibilityLabel: string;
  colors: PriceInputColors;
  currencySymbol: string;
  onChange: (value: number) => void;
  placeholder: string;
  value?: number;
}

export function PriceInput({
  accessibilityLabel,
  colors,
  currencySymbol,
  onChange,
  placeholder,
  value,
}: PriceInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [draftValue, setDraftValue] = useState('');

  // While unfocused the shown text is purely derived from the `value` prop;
  // state is only needed for the in-progress draft the user is typing.
  const formattedPropValue = value ? value.toLocaleString('en-US') : '';
  const displayValue = isFocused ? draftValue : formattedPropValue;

  const handleFocus = () => {
    setIsFocused(true);
    setDraftValue(value ? value.toString() : '');
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleChangeText = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const sanitizedValue =
      parts[0] + (parts.length > 1 ? `.${parts.slice(1).join('')}` : '');
    const formattedValue =
      parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
      (parts.length > 1 ? `.${parts.slice(1).join('')}` : '');

    setDraftValue(formattedValue);

    const parsedValue = Number.parseFloat(sanitizedValue);
    onChange(Number.isNaN(parsedValue) ? 0 : parsedValue);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.inputBg,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.currency, { color: colors.textSecondary }]}>
        {currencySymbol}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        keyboardType="decimal-pad"
        onBlur={handleBlur}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, { color: colors.text }] as TextStyle[]}
        value={displayValue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingLeft: 12,
  },
  currency: {
    fontSize: 16,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
    minHeight: 48,
  },
});
