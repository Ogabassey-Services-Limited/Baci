import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';

export const bnplCheckoutScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  securityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100,
  },
  loadingCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    maxWidth: 300,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 13,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  amountBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderTopWidth: 1,
  },
  amountLabel: {
    fontSize: 14,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '700',
  },
});
