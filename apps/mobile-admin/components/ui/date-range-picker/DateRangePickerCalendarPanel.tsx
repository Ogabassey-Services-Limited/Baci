import Ionicons from "@react-native-vector-icons/ionicons/static";
import { format, isSameDay, isSameMonth } from 'date-fns';
import { Pressable, Text, View } from 'react-native';
import { DATE_RANGE_PICKER_WEEKDAYS } from '@/components/ui/date-range-picker/dateRangePickerConstants';
import { dateRangePickerHelpers } from '@/components/ui/date-range-picker/dateRangePickerHelpers';
import styles from '@/components/ui/date-range-picker/dateRangePickerStyles';
import type { DateRangeSelection } from '@/components/ui/date-range-picker/dateRangePickerTypes';
import { useTheme } from '@/hooks/useTheme';

interface DateRangePickerCalendarPanelProps {
  onApply: () => void;
  onSelectDay: (day: Date) => void;
  onViewNextMonth: () => void;
  onViewPreviousMonth: () => void;
  selection: DateRangeSelection;
  viewDate: Date;
}

export function DateRangePickerCalendarPanel({
  onApply,
  onSelectDay,
  onViewNextMonth,
  onViewPreviousMonth,
  selection,
  viewDate,
}: DateRangePickerCalendarPanelProps) {
  const { colors } = useTheme();
  const days = dateRangePickerHelpers.buildCalendarDays(viewDate);

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.monthNav}>
        <Pressable
          accessibilityHint="Changes the calendar to the previous month"
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          onPress={onViewPreviousMonth}
          style={styles.navButton}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.monthTitle, { color: colors.text }]}>
          {format(viewDate, 'MMMM yyyy')}
        </Text>
        <Pressable
          accessibilityHint="Changes the calendar to the next month"
          accessibilityLabel="Next month"
          accessibilityRole="button"
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          onPress={onViewNextMonth}
          style={styles.navButton}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {DATE_RANGE_PICKER_WEEKDAYS.map((weekday, index) => (
          <Text
            key={`${weekday}-${index}`}
            style={[styles.weekdayText, { color: colors.textMuted }]}
          >
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {days.map((day) => {
          const inCurrentMonth = isSameMonth(day, viewDate);
          const selected = dateRangePickerHelpers.isDateRangeDaySelected(
            day,
            selection
          );
          const inRange = dateRangePickerHelpers.isDateRangeDayInRange(
            day,
            selection
          );

          let backgroundColor = 'transparent';
          let textColor = inCurrentMonth ? colors.text : colors.textMuted;

          if (selected) {
            backgroundColor = colors.primary;
            textColor = '#FFFFFF';
          } else if (inRange) {
            backgroundColor = colors.primaryLight;
            textColor = colors.primary;
          }

          return (
            <Pressable
              accessibilityHint="Double tap to select date"
              accessibilityLabel={format(day, 'EEEE, MMMM do, yyyy')}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={day.toISOString()}
              onPress={() => onSelectDay(day)}
              style={[
                styles.dayCell,
                { backgroundColor },
                selection.start &&
                  isSameDay(day, selection.start) && {
                    borderBottomLeftRadius: 8,
                    borderTopLeftRadius: 8,
                  },
                selection.end &&
                  isSameDay(day, selection.end) && {
                    borderBottomRightRadius: 8,
                    borderTopRightRadius: 8,
                  },
                selected && { borderRadius: 8 },
              ]}
            >
              <Text style={[styles.dayText, { color: textColor }]}>
                {format(day, 'd')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.rangePreview}>
          <Text style={[styles.previewText, { color: colors.textMuted }]}>
            {selection.start ? format(selection.start, 'MMM d') : 'Start'}
            {' - '}
            {selection.end ? format(selection.end, 'MMM d') : 'End'}
          </Text>
        </View>
        <Pressable
          disabled={!selection.start || !selection.end}
          onPress={onApply}
          style={[
            styles.applyButton,
            {
              backgroundColor: colors.primary,
              opacity: selection.start && selection.end ? 1 : 0.5,
            },
          ]}
        >
          <Text style={styles.applyButtonText}>Apply Range</Text>
        </Pressable>
      </View>
    </View>
  );
}
