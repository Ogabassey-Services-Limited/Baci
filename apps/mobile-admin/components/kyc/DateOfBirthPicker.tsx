import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppDatePickerField } from '@/components/ui/AppDatePickerField';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { useTheme } from '@/hooks/useTheme';

interface DateOfBirthPickerProps {
  colors: ReturnType<typeof useTheme>['colors'];
  disabled?: boolean;
  onChange: (date: string) => void;
  value: string;
}

function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function parseValue(value: string, fallback: Date): Date {
  if (value) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

export default function DateOfBirthPicker({
  value,
  onChange,
  colors,
  disabled = false,
}: DateOfBirthPickerProps) {
  // Computed fresh on each render so the bounds don't go stale if the app
  // stays open across date boundaries.
  const maximumDate = yearsAgo(18);
  const minimumDate = yearsAgo(120);
  const [showPicker, setShowPicker] = useState(false);

  const handleOpenPicker = () => {
    setShowPicker(true);
  };

  return (
    <View>
      <Pressable
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
          },
          disabled && styles.inputDisabled,
        ]}
        onPress={handleOpenPicker}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel="Select date of birth"
        accessibilityHint="Opens a date picker"
      >
        <Text
          style={[
            styles.inputText,
            { color: value ? colors.text : colors.textMuted },
          ]}
        >
          {value ? formatDateForDisplay(value) : 'Select date of birth'}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
      </Pressable>

      {showPicker && (
        <AppDatePickerField
          cancelTextColor={colors.textMuted}
          confirmTextColor={colors.primary}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onClose={() => setShowPicker(false)}
          onConfirm={(selectedDate) => onChange(toYYYYMMDD(selectedDate))}
          value={parseValue(value, maximumDate)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: 48,
  },
  inputDisabled: {
    opacity: 0.55,
  },
  inputText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    flex: 1,
  },
});
