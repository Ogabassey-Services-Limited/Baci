import type { IoniconsIconName } from '@react-native-vector-icons/ionicons';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BRAND, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import type { SelectionColors } from './colors';

interface CheckoutSectionCardProps {
  icon: IoniconsIconName;
  title: string;
  colors: SelectionColors;
  isDark: boolean;
  children: ReactNode;
  /** Optional trailing header control (e.g. an Edit/Done toggle). */
  action?: ReactNode;
  /** Let an in-card dropdown (autocomplete / phone country list) escape bounds. */
  overflowVisible?: boolean;
  /** Stack this card above later siblings so its escaping dropdown isn't clipped. */
  zIndex?: number;
}

/**
 * The single source of truth for a checkout section's card chrome + header.
 * Borderless/shadow-only in light mode, hairline in dark. The header icon uses
 * the calm red accent (`BRAND.primary`) on a neutral chip, matching the
 * section/summary/row icons across the redesign; borders and radios remain the
 * primary selection accent.
 */
export function CheckoutSectionCard({
  icon,
  title,
  colors,
  isDark,
  children,
  action,
  overflowVisible = false,
  zIndex,
}: CheckoutSectionCardProps): ReactElement {
  return (
    <View
      testID="checkout-section-card"
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
        },
        overflowVisible ? styles.overflowVisible : null,
        zIndex !== undefined ? { zIndex } : null,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={icon} size={16} color={BRAND.primary} />
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>
        {action ?? null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: 14,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  overflowVisible: { overflow: 'visible' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  title: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
});
