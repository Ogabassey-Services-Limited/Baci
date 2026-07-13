import { Pressable, Text } from 'react-native';
import { BRAND, withAlpha } from '@/constants/Colors';
import type { ImeiCheckerColors } from './imei-check.types';
import { remediationStyles as styles } from './imei-remediation-offer.styles';

export function ImeiRemediationCurrencyOption({
  checked,
  colors,
  label,
  onSelect,
}: {
  checked: boolean;
  colors: ImeiCheckerColors;
  label: string;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={onSelect}
      style={[
        styles.amountOption,
        {
          backgroundColor: checked
            ? withAlpha(BRAND.primary, 0.08)
            : colors.card,
          borderColor: checked ? BRAND.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.optionText, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}
