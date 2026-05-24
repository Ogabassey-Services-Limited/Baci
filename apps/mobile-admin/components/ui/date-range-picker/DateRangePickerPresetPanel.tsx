import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Pressable, Text, View } from 'react-native';
import { DATE_RANGE_PICKER_PRESETS } from '@/components/ui/date-range-picker/dateRangePickerConstants';
import styles from '@/components/ui/date-range-picker/dateRangePickerStyles';
import { useTheme } from '@/hooks/useTheme';

interface DateRangePickerPresetPanelProps {
  activePreset: string | null;
  onClear: () => void;
  onSelectPreset: (preset: string) => void;
}

export function DateRangePickerPresetPanel({
  activePreset,
  onClear,
  onSelectPreset,
}: DateRangePickerPresetPanelProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.presetsContainer}>
      {DATE_RANGE_PICKER_PRESETS.map((preset) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: activePreset === preset }}
          key={preset}
          onPress={() => onSelectPreset(preset)}
          style={[
            styles.presetButton,
            { borderColor: colors.border },
            activePreset === preset && {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.presetText,
              {
                color: activePreset === preset ? colors.primary : colors.text,
              },
            ]}
          >
            {preset}
          </Text>
          {activePreset === preset ? (
            <Ionicons
              color={colors.primary}
              name="checkmark-circle"
              size={20}
            />
          ) : null}
        </Pressable>
      ))}

      <Pressable
        accessibilityHint="Removes the currently selected date range"
        accessibilityLabel="Clear date filter"
        accessibilityRole="button"
        onPress={onClear}
        style={styles.clearButton}
      >
        <Text style={{ color: colors.textMuted }}>Clear Filter</Text>
      </Pressable>
    </View>
  );
}
