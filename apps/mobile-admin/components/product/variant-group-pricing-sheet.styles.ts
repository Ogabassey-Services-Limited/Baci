import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/theme';

export const variantGroupPricingSheetStyles = StyleSheet.create({
  applyButton: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  applyText: {
    fontSize: 16,
    fontWeight: '700',
  },
  axisChip: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  axisChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  axisRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  groupCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  groupCount: {
    fontSize: 12,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  groupInput: {
    flex: 1,
  },
  groupInputs: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  groupLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    marginRight: SPACING.sm,
  },
  groupList: {
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
