import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

export const productCategorySheetStyles = StyleSheet.create({
  sheetContainer: { height: '72%' },
  scrollContent: {
    paddingBottom: SPACING['2xl'],
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  actionsRow: {
    marginBottom: SPACING.md,
    width: '100%',
  },
  toggleButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.xs,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    width: '100%',
  },
  toggleButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  createRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  createButton: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    minWidth: 84,
    paddingHorizontal: SPACING.md,
  },
  createButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.md,
  },
  categoryList: { gap: SPACING.xs },
  categoryItem: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.lg,
  },
  categoryText: { fontSize: TYPOGRAPHY.size.lg },
});
