import { Pressable, ScrollView, Text } from 'react-native';
import Colors, { BRAND } from '@/constants/Colors';
import type { UtilityHistoryFilter } from '@/hooks/use-vtu-history';
import { UTILITY_HISTORY_FILTERS } from './history.constants';
import { styles } from './history.styles';

interface UtilityHistoryFiltersProps {
  colors: typeof Colors.light;
  selectedFilter: UtilityHistoryFilter;
  setSelectedFilter: (filter: UtilityHistoryFilter) => void;
}

export default function UtilityHistoryFilters({
  colors,
  selectedFilter,
  setSelectedFilter,
}: UtilityHistoryFiltersProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
      style={styles.filterScroller}
    >
      {UTILITY_HISTORY_FILTERS.map((filter) => {
        const isSelected = filter.id === selectedFilter;

        return (
          <Pressable
            key={filter.id}
            style={[
              styles.filterChip,
              {
                backgroundColor: isSelected ? BRAND.primary : colors.card,
                borderColor: isSelected ? BRAND.primary : colors.border,
              },
            ]}
            onPress={() => setSelectedFilter(filter.id)}
            accessibilityRole="button"
            accessibilityLabel={`Show ${filter.label.toLowerCase()} history`}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color: isSelected ? colors.white : colors.text,
                },
              ]}
            >
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
