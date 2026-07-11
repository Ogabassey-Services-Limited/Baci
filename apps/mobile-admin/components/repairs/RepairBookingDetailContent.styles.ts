import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const repairBookingDetailStyles = StyleSheet.create({
  body: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.xs,
  },
  content: {
    padding: SPACING.lg,
  },
  device: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xl,
    marginTop: SPACING.sm,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.xs,
    padding: SPACING.sm,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.sm,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
    padding: SPACING.md,
  },
  section: {
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusButton: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  statusButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ticket: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
