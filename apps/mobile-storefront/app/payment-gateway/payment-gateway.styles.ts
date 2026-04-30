import { StyleSheet, type ViewStyle } from 'react-native';
import {
  RADIUS,
  SEMANTIC_COLORS,
  SPACING,
  TYPOGRAPHY,
} from '@/constants/Colors';

const STATUS_ICON_SIZE = 80;
const CENTERED_CONTENT = {
  justifyContent: 'center',
  alignItems: 'center',
} satisfies Pick<ViewStyle, 'alignItems' | 'justifyContent'>;
const CENTERED_CONTAINER = {
  flex: 1,
  ...CENTERED_CONTENT,
  padding: SPACING.xl,
};

export const paymentGatewayStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
  },
  securityText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    ...StyleSheet.absoluteFillObject,
    ...CENTERED_CONTENT,
    backgroundColor: SEMANTIC_COLORS.white,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    ...CENTERED_CONTENT,
    backgroundColor: SEMANTIC_COLORS.overlay,
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
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  amountBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderColor: 'transparent',
    borderTopWidth: 1,
  },
  amountLabel: {
    fontSize: TYPOGRAPHY.size.sm,
  },
  amountValue: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
  },
  centeredContainer: CENTERED_CONTAINER,
  statusIcon: {
    width: STATUS_ICON_SIZE,
    height: STATUS_ICON_SIZE,
    borderRadius: STATUS_ICON_SIZE / 2,
    ...CENTERED_CONTENT,
    marginBottom: SPACING.lg,
  },
  statusTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.bold,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.size.sm * TYPOGRAPHY.lineHeight.relaxed,
  },
  errorActions: {
    marginTop: SPACING.xl,
    gap: SPACING.sm,
    width: '100%',
  },
  baseButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  actionButtonText: {
    color: SEMANTIC_COLORS.white,
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.semibold,
  },
  secondaryButton: {
    borderColor: 'transparent',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.medium,
  },
  errorTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontWeight: TYPOGRAPHY.weight.bold,
    marginTop: SPACING.lg,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.size.sm * TYPOGRAPHY.lineHeight.normal,
    marginBottom: SPACING.lg,
  },
  activityIndicator: {
    marginTop: SPACING.lg,
  },
});
