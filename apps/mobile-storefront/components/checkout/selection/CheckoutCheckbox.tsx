import Ionicons from '@react-native-vector-icons/ionicons';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BRAND } from '@/constants/Colors';
import type { SelectionColors } from './colors';

interface CheckoutCheckboxProps {
  checked: boolean;
  onPress: () => void;
  colors: SelectionColors;
  label: string;
  disabled?: boolean;
}

/**
 * The sanctioned "action" affordance (set-as-default, save-details) — distinct
 * from the radio (mutually-exclusive selection) and the DefaultBadge (read-only
 * status). Always-red box, fills solid on check. The 4px corner is a deliberate
 * exception to the radius scale so it never reads as the round radio ring.
 */
export function CheckoutCheckbox({
  checked,
  onPress,
  colors,
  label,
  disabled = false,
}: CheckoutCheckboxProps): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      style={[styles.row, disabled ? styles.disabled : null]}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: BRAND.primary,
            backgroundColor: checked ? BRAND.primary : 'transparent',
          },
        ]}
      >
        {checked ? (
          <Ionicons name="checkmark" size={14} color={BRAND.onPrimary} />
        ) : null}
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  disabled: { opacity: 0.5 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  label: { flex: 1, fontSize: 14, lineHeight: 20 },
});
