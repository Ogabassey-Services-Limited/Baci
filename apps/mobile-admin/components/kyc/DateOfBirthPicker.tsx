import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { useTheme } from '@/hooks/useTheme';

interface DateOfBirthPickerProps {
  value: string;
  onChange: (date: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function formatDateForDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function toYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseValue(value: string): Date {
  if (value) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date(2000, 0, 1);
}

export default function DateOfBirthPicker({
  value,
  onChange,
  colors,
}: DateOfBirthPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      onChange(toYYYYMMDD(selectedDate));
    }
  };

  const handleConfirmIOS = () => {
    setShowPicker(false);
  };

  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);

  return (
    <View>
      <Pressable
        style={[
          styles.input,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
          },
        ]}
        onPress={() => setShowPicker(true)}
        accessibilityRole="button"
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
        <View>
          {Platform.OS === 'ios' && (
            <View style={styles.iosActions}>
              <Pressable
                onPress={() => setShowPicker(false)}
                accessibilityRole="button"
              >
                <Text style={[styles.actionText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable onPress={handleConfirmIOS} accessibilityRole="button">
                <Text style={[styles.actionText, { color: colors.primary }]}>
                  Done
                </Text>
              </Pressable>
            </View>
          )}
          <DateTimePicker
            value={parseValue(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={eighteenYearsAgo}
            onChange={handleChange}
          />
        </View>
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
  inputText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    flex: 1,
  },
  iosActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  actionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
});
