import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, TYPOGRAPHY } from '@/constants/theme';
import {
  getRepairStatusColors,
  getRepairStatusLabel,
} from '@/lib/repairs/repair-status';
import type { RepairStatus } from '@/types/repair-booking';

interface RepairStatusBadgeProps {
  colors: ThemeColors;
  status: RepairStatus;
}

export function RepairStatusBadge({ colors, status }: RepairStatusBadgeProps) {
  const { background, text } = getRepairStatusColors(status, colors);

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.label, { color: text }]}>
        {getRepairStatusLabel(status)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.xs,
  },
});
