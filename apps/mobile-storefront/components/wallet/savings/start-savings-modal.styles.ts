import {
  BRAND,
  palette,
  RADIUS,
  SPACING,
  TYPOGRAPHY,
  withAlpha,
} from '@/constants/Colors';

const MODAL_DESCRIPTION_LINE_HEIGHT = 16;
const MODAL_BODY_LINE_HEIGHT = 20;
const SUCCESS_ICON_SIZE = 64;

export const startSavingsModalStyles = {
  modalBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(palette.black, 0.45),
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  summaryLabel: {
    fontSize: TYPOGRAPHY.size.sm,
  },
  summaryValue: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    textAlign: 'right',
  },
  fundingOptionRow: {
    gap: SPACING.xs,
  },
  fundingOptionCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  fundingOptionTitle: {
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  fundingOptionDescription: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: SPACING.xs,
    lineHeight: MODAL_DESCRIPTION_LINE_HEIGHT,
  },
  savedPaymentMethodList: {
    gap: SPACING.xs,
  },
  savedPaymentMethodCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  savedPaymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  savedPaymentMethodTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  savedPaymentMethodMeta: {
    fontSize: TYPOGRAPHY.size.xs,
    lineHeight: MODAL_DESCRIPTION_LINE_HEIGHT,
    textTransform: 'uppercase',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.size.sm,
    lineHeight: MODAL_BODY_LINE_HEIGHT,
  },
  emptyFundingAccountText: {
    fontSize: TYPOGRAPHY.size.sm,
    lineHeight: MODAL_BODY_LINE_HEIGHT,
  },
  outlineButton: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  outlineButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  transferCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  transferAccountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  transferMetaLabel: {
    fontSize: TYPOGRAPHY.size.xs,
  },
  transferMetaValue: {
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  transferActionRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  modalCloseButton: {
    marginTop: SPACING.xs,
    alignSelf: 'center',
  },
  modalCloseText: {
    fontSize: TYPOGRAPHY.size.sm,
  },
  successIconWrap: {
    width: SUCCESS_ICON_SIZE,
    height: SUCCESS_ICON_SIZE,
    borderRadius: RADIUS.full,
    backgroundColor: withAlpha(BRAND.primary, 0.1),
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
} as const;
