import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  amountCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    gap: 4,
  },
  amountLabel: {
    fontSize: 13,
  },
  amountValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  chainLabel: {
    fontSize: 13,
  },
  fiatAmount: {
    fontSize: 14,
    marginTop: 4,
  },
  addressCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  copyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  warningCard: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  warningContent: {
    flex: 1,
  },
  warningText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bottomActions: {
    padding: SPACING.lg,
    borderTopWidth: 1,
  },
  actionButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
});
