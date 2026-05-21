import { StyleSheet } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  DEFAULT_CLOSE_TOP,
  DEFAULT_HEADER_PADDING,
} from './paywall.constants';

export const paywallStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 160,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: DEFAULT_HEADER_PADDING,
    paddingBottom: 25,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  closeButton: {
    position: 'absolute',
    top: DEFAULT_CLOSE_TOP,
    right: 20,
    width: 32,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerIcon: {
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#FFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING['2xl'],
    paddingBottom: SPACING.lg,
  },
  featureList: {
    marginBottom: SPACING.lg,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  packageContainer: {
    gap: SPACING.md,
  },
  tierCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
  },
  tierInfo: {
    flex: 1,
  },
  tierTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 4,
  },
  savingsBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  tierPricing: {
    alignItems: 'flex-end',
  },
  tierPrice: {
    fontSize: 20,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  tierPeriod: {
    fontSize: 12,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.xl,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
  },
  mainButton: {
    height: 56,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  mainButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  smallLink: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  footerLinkTouchTarget: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  subscriptionDisclosure: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    lineHeight: 14,
    marginBottom: SPACING.sm,
  },
});
