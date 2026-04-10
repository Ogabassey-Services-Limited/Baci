import { Ionicons } from '@expo/vector-icons';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface DateRange {
  start: Date | null;
  end: Date | null;
}

interface DateRangePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (range: string | DateRange | null) => void;
  currentFilter: string | DateRange | null;
}

const PRESETS = ['Today', 'Last 7 Days', 'Last 30 Days', 'This Month'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function DateRangePicker({
  visible,
  onClose,
  onSelect,
  currentFilter,
}: DateRangePickerProps) {
  const { colors, shadows } = useTheme();
  const screenHeight = Dimensions.get('window').height;

  // State
  const [mode, setMode] = useState<'presets' | 'calendar'>('presets');
  const [viewDate, setViewDate] = useState(new Date());
  const [selection, setSelection] = useState<DateRange>({
    start: null,
    end: null,
  });

  // Initialize state when opening
  useEffect(() => {
    if (visible) {
      if (typeof currentFilter === 'object' && currentFilter?.start) {
        setMode('calendar');
        setSelection(currentFilter);
        setViewDate(currentFilter.start);
      } else {
        setMode('presets');
        setSelection({ start: null, end: null });
        setViewDate(new Date());
      }
    }
  }, [visible, currentFilter]);

  // Calendar Logic
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handleDayPress = (day: Date) => {
    let newSelection = { ...selection };

    if (!newSelection.start || (newSelection.start && newSelection.end)) {
      // Start new selection
      newSelection = { start: day, end: null };
    } else {
      // Complete selection
      if (isBefore(day, newSelection.start)) {
        newSelection = { start: day, end: newSelection.start };
      } else {
        newSelection = { ...newSelection, end: day };
      }
    }
    setSelection(newSelection);
  };

  const isSelected = (day: Date) => {
    if (!selection.start) return false;
    if (selection.end) {
      return isSameDay(day, selection.start) || isSameDay(day, selection.end);
    }
    return isSameDay(day, selection.start);
  };

  const isInRange = (day: Date) => {
    if (selection.start && selection.end) {
      return isWithinInterval(day, {
        start: selection.start,
        end: selection.end,
      });
    }
    return false;
  };

  const activePreset = typeof currentFilter === 'string' ? currentFilter : null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[
            styles.container,
            { backgroundColor: colors.card, maxHeight: screenHeight * 0.8 },
            shadows.lg,
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              Select Date Range
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close date picker"
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Mode Switcher */}
          <View
            style={[
              styles.modeSwitcher,
              { backgroundColor: colors.background },
            ]}
          >
            <Pressable
              style={[
                styles.modeButton,
                mode === 'presets' && {
                  backgroundColor: colors.card,
                  shadowColor: '#000',
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 1,
                },
              ]}
              onPress={() => setMode('presets')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'presets' }}
            >
              <Text
                style={[
                  styles.modeText,
                  {
                    color: mode === 'presets' ? colors.text : colors.textMuted,
                  },
                ]}
              >
                Presets
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.modeButton,
                mode === 'calendar' && {
                  backgroundColor: colors.card,
                  shadowColor: '#000',
                  shadowOpacity: 0.1,
                  shadowRadius: 2,
                  elevation: 1,
                },
              ]}
              onPress={() => setMode('calendar')}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'calendar' }}
            >
              <Text
                style={[
                  styles.modeText,
                  {
                    color: mode === 'calendar' ? colors.text : colors.textMuted,
                  },
                ]}
              >
                Custom
              </Text>
            </Pressable>
          </View>

          <ScrollView style={styles.content}>
            {mode === 'presets' ? (
              <View style={styles.presetsContainer}>
                {PRESETS.map((preset) => (
                  <Pressable
                    key={preset}
                    style={[
                      styles.presetButton,
                      { borderColor: colors.border },
                      activePreset === preset && {
                        borderColor: colors.primary,
                        backgroundColor: colors.primaryLight,
                      },
                    ]}
                    onPress={() => {
                      onSelect(preset);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activePreset === preset }}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        {
                          color:
                            activePreset === preset
                              ? colors.primary
                              : colors.text,
                        },
                      ]}
                    >
                      {preset}
                    </Text>
                    {activePreset === preset && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                ))}

                <Pressable
                  style={[styles.clearButton]}
                  onPress={() => {
                    onSelect(null);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear date filter"
                  accessibilityHint="Removes the currently selected date range"
                >
                  <Text style={{ color: colors.textMuted }}>Clear Filter</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.calendarContainer}>
                {/* Month Nav */}
                <View style={styles.monthNav}>
                  <Pressable
                    onPress={() => setViewDate(subMonths(viewDate, 1))}
                    style={styles.navButton}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color={colors.text}
                    />
                  </Pressable>
                  <Text style={[styles.monthTitle, { color: colors.text }]}>
                    {format(viewDate, 'MMMM yyyy')}
                  </Text>
                  <Pressable
                    onPress={() => setViewDate(addMonths(viewDate, 1))}
                    style={styles.navButton}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.text}
                    />
                  </Pressable>
                </View>

                {/* Weekdays */}
                <View style={styles.weekRow}>
                  {WEEKDAYS.map((day, i) => (
                    <Text
                      key={i}
                      style={[styles.weekdayText, { color: colors.textMuted }]}
                    >
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Days Grid */}
                <View style={styles.daysGrid}>
                  {days.map((day, index) => {
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const selected = isSelected(day);
                    const inRange = isInRange(day);

                    // Styling logic
                    let bg = 'transparent';
                    let textColor = isCurrentMonth
                      ? colors.text
                      : colors.textMuted;

                    if (selected) {
                      bg = colors.primary;
                      textColor = '#FFFFFF';
                    } else if (inRange) {
                      bg = colors.primaryLight; // Light primary opacity
                      textColor = colors.primary;
                    }

                    return (
                      <Pressable
                        key={index}
                        style={[
                          styles.dayCell,
                          { backgroundColor: bg },
                          // Start/End rounding
                          selection.start &&
                            isSameDay(day, selection.start) && {
                              borderTopLeftRadius: 8,
                              borderBottomLeftRadius: 8,
                            },
                          selection.end &&
                            isSameDay(day, selection.end) && {
                              borderTopRightRadius: 8,
                              borderBottomRightRadius: 8,
                            },
                          selected && { borderRadius: 8 }, // override if simple selection
                        ]}
                        onPress={() => handleDayPress(day)}
                        accessibilityRole="button"
                        accessibilityLabel={format(day, 'EEEE, MMMM do, yyyy')}
                        accessibilityState={{ selected }}
                        accessibilityHint="Double tap to select date"
                      >
                        <Text style={[styles.dayText, { color: textColor }]}>
                          {format(day, 'd')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Apply Button */}
                <View style={styles.footer}>
                  <View style={styles.rangePreview}>
                    <Text
                      style={[
                        styles.previewText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {selection.start
                        ? format(selection.start, 'MMM d')
                        : 'Start'}
                      {' - '}
                      {selection.end ? format(selection.end, 'MMM d') : 'End'}
                    </Text>
                  </View>
                  <Pressable
                    style={[
                      styles.applyButton,
                      {
                        backgroundColor: colors.primary,
                        opacity: selection.start && selection.end ? 1 : 0.5,
                      },
                    ]}
                    disabled={!selection.start || !selection.end}
                    onPress={() => {
                      if (selection.start && selection.end) {
                        onSelect(selection);
                        onClose();
                      }
                    }}
                  >
                    <Text style={styles.applyButtonText}>Apply Range</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  content: {
    // Removed fixed maxHeight to allow container to control size
  },
  modeSwitcher: {
    flexDirection: 'row',
    padding: 4,
    margin: SPACING.md,
    borderRadius: RADIUS.md,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  modeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  presetsContainer: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  presetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  presetText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  clearButton: {
    alignItems: 'center',
    padding: SPACING.md,
  },
  calendarContainer: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl, // Add extra padding for button
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    opacity: 0.7,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%', // 100/7
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  dayText: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  footer: {
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  rangePreview: {
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  previewText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  applyButton: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFF',
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
