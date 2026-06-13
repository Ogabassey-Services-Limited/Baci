import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { ThemeColors } from './types';

interface OrdersHeaderProps {
  colors: ThemeColors;
  onOpenReport: () => void;
  onOpenDatePicker: () => void;
}

export function OrdersHeader({
  colors,
  onOpenReport,
  onOpenDatePicker,
}: OrdersHeaderProps) {
  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text }]}>Orders</Text>
      <View style={styles.actions}>
        <Pressable
          style={[styles.calendarButton, { backgroundColor: colors.card }]}
          onPress={onOpenReport}
          accessibilityLabel="Generate order report"
          accessibilityRole="button"
          accessibilityHint="Opens report generation options"
        >
          <Ionicons
            name="document-text-outline"
            size={22}
            color={colors.primary}
          />
        </Pressable>
        <Pressable
          style={[styles.calendarButton, { backgroundColor: colors.card }]}
          onPress={onOpenDatePicker}
          accessibilityLabel="Filter by date range"
          accessibilityRole="button"
          accessibilityHint="Opens date range picker"
        >
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  actions: { flexDirection: 'row', gap: 8 },
  calendarButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
