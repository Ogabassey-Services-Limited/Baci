import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/theme';

export const variantBuilderSheetStyles = StyleSheet.create({
  addOptionButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.xs,
    justifyContent: 'center',
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
  },
  addOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  conditionChip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  conditionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  generateButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  generateText: {
    fontSize: 16,
    fontWeight: '700',
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  limitWarning: {
    fontSize: 13,
    marginTop: SPACING.lg,
  },
  optionList: {
    gap: SPACING.md,
  },
  sectionHint: {
    fontSize: 13,
    marginTop: SPACING.xs,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: SPACING.xl,
  },
});
