import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { styles } from './ShipmentFlowSheet.styles';

interface ShipmentFieldProps {
  children: ReactNode;
  colors: ThemeColors;
  label: string;
  required?: boolean;
  value: string;
  withInnerPadding?: boolean;
}

export function ShipmentField({
  children,
  colors,
  label,
  required = false,
  value,
  withInnerPadding = true,
}: ShipmentFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View
        style={[
          styles.fieldInputWrap,
          withInnerPadding ? styles.fieldInputWrapPadded : null,
          {
            backgroundColor: colors.backgroundLight,
            borderColor: value.trim() ? colors.primary : colors.border,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}
