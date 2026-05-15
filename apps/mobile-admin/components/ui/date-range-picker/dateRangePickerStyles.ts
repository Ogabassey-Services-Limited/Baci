import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

const dateRangePickerStyles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    justifyContent: 'center',
    padding: SPACING.md,
  },
  container: {
    borderRadius: RADIUS.lg,
    maxWidth: 400,
    overflow: 'hidden',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
  },
  content: {},
  modeSwitcher: {
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    margin: SPACING.md,
    padding: 4,
  },
  modeButton: {
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    flex: 1,
    paddingVertical: 8,
  },
  modeText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  presetsContainer: {
    gap: SPACING.md,
    padding: SPACING.md,
  },
  presetButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.lg,
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
    paddingBottom: SPACING.xl,
  },
  monthNav: {
    alignItems: 'center',
    flexDirection: 'row',
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
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    alignItems: 'center',
    aspectRatio: 1,
    justifyContent: 'center',
    marginVertical: 1,
    width: '14.28%',
  },
  dayText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: 14,
  },
  footer: {
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  rangePreview: {
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  previewText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  applyButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  applyButtonText: {
    color: '#FFF',
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});

export default dateRangePickerStyles;
