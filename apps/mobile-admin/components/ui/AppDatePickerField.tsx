import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isRuntimePlatform } from '@/config/runtime-platform';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';

interface AppDatePickerFieldProps {
  cancelLabel?: string;
  cancelTextColor?: string;
  confirmLabel?: string;
  confirmTextColor?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  value: Date;
}

export function AppDatePickerField({
  cancelLabel = 'Cancel',
  cancelTextColor,
  confirmLabel = 'Done',
  confirmTextColor,
  maximumDate,
  minimumDate,
  onClose,
  onConfirm,
  value,
}: AppDatePickerFieldProps) {
  const [tempDate, setTempDate] = useState(value);
  const isIos = isRuntimePlatform('ios');

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (isRuntimePlatform('android')) {
      onClose();
      if (event.type === 'dismissed') {
        return;
      }
      if (selectedDate) {
        onConfirm(selectedDate);
      }
      return;
    }

    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleConfirmIOS = () => {
    onConfirm(tempDate);
    onClose();
  };

  const pickerValue = isIos ? tempDate : value;
  const pickerDisplay = isIos ? 'spinner' : 'default';

  return (
    <View>
      {isIos ? (
        <View style={styles.iosActions}>
          <Pressable
            accessibilityLabel="Cancel date selection"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={onClose}
          >
            <Text style={[styles.actionText, cancelTextColor && { color: cancelTextColor }]}>
              {cancelLabel}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Confirm date selection"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={handleConfirmIOS}
          >
            <Text style={[styles.actionText, confirmTextColor && { color: confirmTextColor }]}>
              {confirmLabel}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <DateTimePicker
        display={pickerDisplay}
        maximumDate={maximumDate}
        minimumDate={minimumDate}
        mode="date"
        onChange={handleDateChange}
        value={pickerValue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
