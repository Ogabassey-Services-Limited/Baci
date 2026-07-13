import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { RepairBookingsStatusFilter } from '@/hooks/useRepairBookings';
import { getRepairStatusLabel } from '@/lib/repairs/repair-status';
import { REPAIR_STATUSES } from '@/types/repair-booking';

interface RepairStatusFilterChipsProps {
  colors: ThemeColors;
  onSelect: (status: RepairBookingsStatusFilter) => void;
  selected: RepairBookingsStatusFilter;
}

const FILTERS: RepairBookingsStatusFilter[] = ['all', ...REPAIR_STATUSES];

function filterLabel(filter: RepairBookingsStatusFilter): string {
  return filter === 'all' ? 'All' : getRepairStatusLabel(filter);
}

export function RepairStatusFilterChips({
  colors,
  onSelect,
  selected,
}: RepairStatusFilterChipsProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {FILTERS.map((filter) => {
        const isActive = filter === selected;
        return (
          <Pressable
            accessibilityLabel={filterLabel(filter)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={filter}
            onPress={() => onSelect(filter)}
            style={[
              styles.chip,
              { backgroundColor: isActive ? colors.gold : colors.card },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.textOnGold : colors.textSecondary },
              ]}
            >
              {filterLabel(filter)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    marginRight: SPACING.sm,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  content: {
    paddingHorizontal: SPACING.md,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
