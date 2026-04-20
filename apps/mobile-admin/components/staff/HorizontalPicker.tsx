import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface HorizontalPickerOption {
  id: string;
  label: string;
  accessibilityLabel?: string;
}

interface HorizontalPickerProps {
  label: string;
  groupAccessibilityLabel: string;
  options: HorizontalPickerOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  noneLabel: string;
  noneAccessibilityLabel: string;
  colors: ThemeColors;
  isLoading?: boolean;
  loadingLabel?: string;
  hasError?: boolean;
  errorLabel?: string;
}

export function HorizontalPicker({
  label,
  groupAccessibilityLabel,
  options,
  selectedId,
  onSelect,
  noneLabel,
  noneAccessibilityLabel,
  colors,
  isLoading = false,
  loadingLabel = 'Loading...',
  hasError = false,
  errorLabel = 'Unavailable',
}: HorizontalPickerProps) {
  return (
    <>
      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pickerScroll}
        accessibilityRole="radiogroup"
        accessibilityLabel={groupAccessibilityLabel}
      >
        <Pressable
          style={[
            styles.pickerOption,
            {
              backgroundColor: !selectedId
                ? `${colors.primary}10`
                : 'transparent',
              borderColor: !selectedId ? colors.primary : colors.border,
            },
          ]}
          onPress={() => onSelect(null)}
          accessibilityRole="radio"
          accessibilityState={{ checked: !selectedId }}
          accessibilityLabel={noneAccessibilityLabel}
        >
          <Text
            style={[
              styles.pickerText,
              { color: !selectedId ? colors.primary : colors.text },
            ]}
          >
            {noneLabel}
          </Text>
        </Pressable>

        {isLoading ? (
          <View
            accessible
            style={[
              styles.pickerOption,
              {
                backgroundColor: colors.cardHover,
                borderColor: colors.border,
                opacity: 0.7,
              },
            ]}
            accessibilityLabel={loadingLabel}
            accessibilityLiveRegion="polite"
          >
            <Text style={[styles.pickerText, { color: colors.textSecondary }]}>
              {loadingLabel}
            </Text>
          </View>
        ) : null}

        {hasError ? (
          <View
            style={[
              styles.pickerOption,
              {
                backgroundColor: colors.errorLight,
                borderColor: colors.error,
              },
            ]}
            accessibilityRole="alert"
            accessibilityLabel={errorLabel}
          >
            <Text style={[styles.pickerText, { color: colors.error }]}>
              {errorLabel}
            </Text>
          </View>
        ) : null}

        {options.map((option) => {
          const isSelected = selectedId === option.id;

          return (
            <Pressable
              key={option.id}
              style={[
                styles.pickerOption,
                {
                  backgroundColor: isSelected
                    ? `${colors.primary}10`
                    : 'transparent',
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onSelect(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={option.accessibilityLabel ?? option.label}
            >
              <Text
                style={[
                  styles.pickerText,
                  { color: isSelected ? colors.primary : colors.text },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  inputLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  pickerScroll: {
    marginBottom: SPACING.sm,
  },
  pickerOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  pickerText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
