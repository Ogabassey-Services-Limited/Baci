import { StyleSheet } from 'react-native';
import { palette, RADIUS, SPACING } from '@/constants/Colors';
import { IMEI_MONOSPACE_FONT } from './imei-check-theme';

export const resultStyles = StyleSheet.create({
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  deviceImageContainer: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    // Intentionally always white to match device image expectations.
    backgroundColor: palette.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  deviceImage: {
    width: 60,
    height: 60,
  },
  deviceInfo: {
    flex: 1,
  },
  tierBadge: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  imeiText: {
    fontSize: 11,
    fontFamily: IMEI_MONOSPACE_FONT,
    marginTop: 2,
  },
  modelText: {
    fontSize: 10,
    marginTop: 2,
  },
  scoreContainer: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusGrid: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  verdictContainer: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  verdictText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
