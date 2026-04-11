import { Ionicons } from '@expo/vector-icons';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const [tempDate, setTempDate] = useState<Date>(() =>
    parseValue(value, maximumDate)
  );

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'dismissed') return;
      if (selectedDate) onChange(toYYYYMMDD(selectedDate));
    } else if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleOpenPicker = () => {
    setTempDate(parseValue(value, maximumDate));
    setShowPicker(true);
  };

  const handleConfirmIOS = () => {
    onChange(toYYYYMMDD(tempDate));
    setShowPicker(false);
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
        ]}
        onPress={handleOpenPicker}
        disabled={disabled}
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
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Cancel date selection"
              >
                <Text style={[styles.actionText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmIOS}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Confirm date selection"
              >
                <Text style={[styles.actionText, { color: colors.primary }]}>
                  Done
                </Text>
              </Pressable>
            </View>
          )}
          <DateTimePicker
            value={
              Platform.OS === 'ios' ? tempDate : parseValue(value, maximumDate)
            }
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
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
