import { Pressable, Text, View } from 'react-native';
import styles from './FilterSheet.styles';

type FilterSheetPresetColors = {
  border: string;
  muted: string;
  textSecondary: string;
};

type FilterSheetPresetsProps = {
  colors: FilterSheetPresetColors;
  onSelectRange: (min: string, max: string) => void;
};

const pricePresets = [
  {
    label: 'Under 50,000 Naira',
    display: 'Under ₦50k',
    min: '0',
    max: '50000',
  },
  {
    label: '50,000 to 150,000 Naira',
    display: '₦50k - ₦150k',
    min: '50000',
    max: '150000',
  },
  {
    label: '150,000 to 300,000 Naira',
    display: '₦150k - ₦300k',
    min: '150000',
    max: '300000',
  },
  {
    label: 'Above 300,000 Naira',
    display: 'Above ₦300k',
    min: '300000',
    max: '3000000',
  },
] as const;

export function FilterSheetPresets({
  colors,
  onSelectRange,
}: FilterSheetPresetsProps) {
  return (
    <View style={styles.presets}>
      <Text style={[styles.presetsLabel, { color: colors.textSecondary }]}>
        Quick Select:
      </Text>
      <View
        style={styles.presetButtons}
        accessibilityRole="summary"
        accessibilityLabel="Quick price range presets"
      >
        {pricePresets.map((preset) => (
          <Pressable
            key={preset.label}
            style={[
              styles.presetButton,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
              },
            ]}
            onPress={() => onSelectRange(preset.min, preset.max)}
            accessibilityLabel={preset.label}
            accessibilityRole="button"
          >
            <Text style={[styles.presetText, { color: colors.textSecondary }]}>
              {preset.display}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
