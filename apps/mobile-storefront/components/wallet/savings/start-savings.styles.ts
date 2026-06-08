import { StyleSheet } from 'react-native';
import {
  BRAND,
  palette,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/Colors';
import { startSavingsModalStyles } from './start-savings-modal.styles';

export const startSavingsStyles = StyleSheet.create({
  ...startSavingsModalStyles,
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING['3xl'],
    gap: SPACING.md,
  },
  heading: {
    fontSize: TYPOGRAPHY.size['2xl'],
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  subheading: {
    fontSize: TYPOGRAPHY.size.sm,
    lineHeight: 20,
  },
  section: {
    gap: SPACING.sm,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.size.base,
  },
  pickerField: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    justifyContent: 'center',
  },
  pickerFieldText: {
    fontSize: TYPOGRAPHY.size.base,
  },
  productSuggestions: {
    gap: SPACING.xs,
  },
  productSuggestionRow: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  productSuggestionName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  productSuggestionPrice: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: 2,
  },
  productMetaText: {
    fontSize: TYPOGRAPHY.size.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  selectedProductCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 6,
  },
  selectedProductLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    textTransform: 'uppercase',
  },
  selectedProductName: {
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  selectedProductPrice: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  frequencyOption: {
    flex: 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyOptionLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  rowItem: {
    flex: 1,
    gap: SPACING.sm,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  radioDot: {
    width: 14,
    height: 14,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  sourceModeCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  sourceModeRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  sourceModeOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceModeLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  sourceModeHint: {
    fontSize: TYPOGRAPHY.size.xs,
    lineHeight: 16,
    marginTop: SPACING.xs,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
  },
  checkboxMark: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.xs,
    lineHeight: 18,
  },
  errorText: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: -SPACING.xs,
  },
  primaryButton: {
    backgroundColor: BRAND.primary,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
