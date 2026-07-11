import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, type ThemeColors } from '@/constants/theme';
import type {
  VariantAxis,
  VariantFilterSelection,
} from '@/lib/variant-group-pricing';

interface VariantFilterChipsProps {
  axes: VariantAxis[];
  colors: ThemeColors;
  onChange: (selection: VariantFilterSelection) => void;
  selection: VariantFilterSelection;
}

export function VariantFilterChips({
  axes,
  colors,
  onChange,
  selection,
}: VariantFilterChipsProps) {
  // Filtering only helps when an axis has at least two values to choose from.
  const filterableAxes = axes.filter((axis) => axis.values.length > 1);
  if (filterableAxes.length === 0) {
    return null;
  }

  const toggleValue = (axisId: string, value: string) => {
    onChange({
      ...selection,
      [axisId]: selection[axisId] === value ? null : value,
    });
  };

  return (
    <View style={styles.container}>
      {filterableAxes.map((axis) => (
        <View key={axis.id} style={styles.axisRow}>
          {axis.values.map((value) => {
            const isSelected = selection[axis.id] === value;
            const label = axis.valueLabels[value] ?? value;
            return (
              <Pressable
                accessibilityLabel={`Filter by ${axis.label} ${label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                key={value}
                onPress={() => toggleValue(axis.id, value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected
                      ? colors.primaryLight
                      : colors.inputBg,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isSelected ? colors.primary : colors.text },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  axisRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  chip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  container: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
});
