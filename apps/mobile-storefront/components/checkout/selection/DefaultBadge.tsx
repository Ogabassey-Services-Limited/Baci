import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BRAND, RADIUS } from '@/constants/Colors';

interface DefaultBadgeProps {
  label?: string;
}

/**
 * Read-only status pill (the §1 sanctioned badge slot) — a 12% red tint with
 * solid red text. Not pressable; not a selection. Used for "Default" and, on
 * delivery, the "Free" pickup price.
 */
export function DefaultBadge({ label = 'Default' }: DefaultBadgeProps): ReactElement {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: BRAND.primaryAlpha12,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { color: BRAND.primary, fontSize: 11, fontWeight: '700' },
});
