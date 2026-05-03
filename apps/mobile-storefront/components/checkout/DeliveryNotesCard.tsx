import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { RADIUS, SHADOWS, SPACING } from '@/constants/Colors';

type ColorsScheme = (typeof Colors)['light'];

interface DeliveryNotesCardProps {
  colors: ColorsScheme;
  isDark: boolean;
  children: ReactNode;
}

export function DeliveryNotesCard({
  colors,
  isDark,
  children,
}: DeliveryNotesCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <Ionicons
          name="chatbubble-ellipses-outline"
          size={16}
          color={colors.textSecondary}
        />
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          Delivery Notes
        </Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Notes (Optional)
        </Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingTop: 14,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardBody: {
    gap: SPACING.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
});
