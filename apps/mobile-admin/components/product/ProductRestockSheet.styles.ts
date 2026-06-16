import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const productRestockSheetStyles = StyleSheet.create({
  helperText: {
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: TYPOGRAPHY.size.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modeTab: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: SPACING.md,
  },
  modeText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '600',
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  radioItem: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
  },
  submitButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  submitText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: '700',
  },
  textarea: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    fontSize: TYPOGRAPHY.size.md,
    minHeight: 120,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    textAlignVertical: 'top',
  },
});
