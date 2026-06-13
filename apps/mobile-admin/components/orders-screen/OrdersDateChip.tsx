import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { ThemeColors } from './types';

interface OrdersDateChipProps {
  label: string | null;
  colors: ThemeColors;
  onClear: () => void;
}

export function OrdersDateChip({
  label,
  colors,
  onClear,
}: OrdersDateChipProps) {
  if (!label) return null;

  return (
    <View style={styles.dateChipContainer}>
      <View style={[styles.dateChip, { backgroundColor: colors.goldLight }]}>
        <Ionicons name="calendar" size={14} color={colors.gold} />
        <Text style={[styles.dateChipText, { color: colors.gold }]}>
          {label}
        </Text>
        <Pressable
          onPress={onClear}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Clear date filter"
          accessibilityRole="button"
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={16} color={colors.gold} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dateChipContainer: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  dateChipText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  clearButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
