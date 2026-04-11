import { Text, TextInput } from 'react-native';
import type { useTheme } from '@/hooks/useTheme';
import { verificationCardStyles as styles } from './verification-card-styles';

interface BvnMobileNumberFieldProps {
  colors: ReturnType<typeof useTheme>['colors'];
  disabled: boolean;
  mobileNo: string;
  onChangeText: (value: string) => void;
}

export default function BvnMobileNumberField({
  colors,
  disabled,
  mobileNo,
  onChangeText,
}: BvnMobileNumberFieldProps) {
  return (
    <>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Mobile Number
      </Text>
      <TextInput
        style={[
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
          },
        ]}
        placeholder="08012345678"
        placeholderTextColor={colors.textMuted}
        value={mobileNo}
        onChangeText={(value) =>
          onChangeText(value.replace(/\D/g, '').slice(0, 11))
        }
        keyboardType="phone-pad"
        maxLength={11}
        editable={!disabled}
        accessibilityLabel="Mobile number input"
      />
    </>
  );
}
