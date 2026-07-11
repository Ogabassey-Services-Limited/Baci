import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/theme';

export const productVariantRowStyles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
    overflow: 'hidden',
  },
  // Collapsed summary header (always visible)
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  swatch: {
    borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth,
    height: 26,
    width: 26,
  },
  swatchFallback: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  swatchFallbackText: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryContent: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  summarySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  // Expanded editor body
  editorBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  input: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    fontSize: 15,
    padding: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  halfInput: {
    flex: 1,
  },
  similarChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  similarChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  removeVariantButton: {
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
    marginTop: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  removeVariantLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
