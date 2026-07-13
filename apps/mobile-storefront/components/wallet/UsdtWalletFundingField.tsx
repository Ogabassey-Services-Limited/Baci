import { Text, TextInput, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { usdtFundingStyles as styles } from './usdt-wallet-funding.styles';

export function UsdtWalletFundingField({
  accessibilityLabel,
  colors,
  label,
  maxLength,
  onChange,
  value,
}: {
  accessibilityLabel?: string;
  colors: typeof Colors.light;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel ?? label}
        maxLength={maxLength}
        onChangeText={onChange}
        style={[
          styles.input,
          { borderColor: colors.border, color: colors.text },
        ]}
        value={value}
      />
    </View>
  );
}
