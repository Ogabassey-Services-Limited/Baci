import { useEffect, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextStyle,
} from 'react-native';

interface CartQuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  style?: StyleProp<TextStyle>;
}

const localStyles = StyleSheet.create({
  input: {
    minWidth: 28,
    textAlign: 'center',
  },
});

export default function CartQuantityInput({
  value,
  onChange,
  style,
}: CartQuantityInputProps) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleCommit = () => {
    const parsed = Number.parseInt(localValue, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setLocalValue(value.toString());
    } else {
      onChange(parsed);
    }
  };

  return (
    <TextInput
      style={[localStyles.input, style]}
      value={localValue}
      textAlignVertical="center"
      accessibilityLabel="Quantity input"
      accessibilityHint="Enter quantity for this item, must be a positive integer."
      accessibilityRole="adjustable"
      maxLength={3}
      onChangeText={(text) => {
        const cleanText = text.replace(/[^0-9]/g, '');
        setLocalValue(cleanText);
      }}
      onBlur={handleCommit}
      onSubmitEditing={handleCommit}
      keyboardType="number-pad"
      returnKeyType="done"
    />
  );
}
