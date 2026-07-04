import { StyleSheet } from 'react-native';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';

export const paymentMethodSelectorStyles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  installmentInfo: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  installmentTextContainer: {
    flex: 1,
  },
  installmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  installmentDesc: {
    fontSize: 13,
    marginBottom: SPACING.xs,
  },
  installmentNote: {
    fontSize: 11,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  methodsContainer: {
    gap: SPACING.sm,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  methodLogo: {
    width: 32,
    height: 32,
  },
  methodInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    minWidth: 0,
  },
  methodBadge: {
    backgroundColor: `${BRAND.primary}20`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  methodBadgeText: {
    color: BRAND.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  methodLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  methodTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  methodDesc: {
    fontSize: 13,
    flexShrink: 1,
    lineHeight: 18,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: SPACING.sm,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  bankInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  storeCreditIndicatorInner: {
    backgroundColor: BRAND.primary,
  },
  // Slim store-credit toggle line — a modifier under the selected method, kept
  // visually lighter than the payment-method rows so it doesn't read as one.
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  creditIcon: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  creditInfo: {
    flex: 1,
    minWidth: 0,
  },
  creditLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  creditDesc: {
    fontSize: 12,
    marginTop: 1,
    lineHeight: 16,
  },
  creditIndicator: {
    width: 20,
    height: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
});

export const paymentIntentAccordionStyles = StyleSheet.create({
  intentGroup: {
    gap: SPACING.sm,
  },
  intentCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    overflow: 'hidden',
  },
  intentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  intentIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  intentInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    minWidth: 0,
  },
  intentLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  intentSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  intentRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: SPACING.sm,
  },
  intentRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  intentChevron: {
    marginLeft: SPACING.sm,
  },
  intentNested: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.xs,
    gap: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  intentInstrumentGroup: {
    gap: SPACING.sm,
  },
});
