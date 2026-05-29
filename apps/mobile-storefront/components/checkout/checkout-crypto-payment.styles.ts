import { Platform, StyleSheet } from 'react-native';
import { BRAND, palette, RADIUS, SPACING, withAlpha } from '@/constants/Colors';

export const checkoutCryptoPaymentStyles = StyleSheet.create({
  cryptoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  cryptoHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cryptoHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.onPrimary,
  },
  cryptoBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: withAlpha(BRAND.onPrimary, 0.2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: withAlpha(BRAND.onPrimary, 0.2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cryptoAmountCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    gap: 4,
  },
  cryptoAmountLabel: {
    fontSize: 13,
  },
  cryptoAmountValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  cryptoChainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.gray[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  cryptoPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.emerald[500],
  },
  cryptoChainText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.gray[700],
  },
  cryptoAddressCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  cryptoFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.gray[400],
    letterSpacing: 0.5,
  },
  cryptoAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  cryptoAddressText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
  },
  cryptoCopyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cryptoWarning: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: palette.amber[50],
  },
  cryptoWarningText: {
    flex: 1,
    fontSize: 12,
    color: palette.amber[800],
    lineHeight: 18,
  },
  cryptoInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  cryptoInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  cryptoReference: {
    textAlign: 'center',
    fontSize: 12,
  },
  cryptoBottomAction: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
  cryptoDoneBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  cryptoDoneBtnText: {
    color: BRAND.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  cryptoHelpText: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
});
