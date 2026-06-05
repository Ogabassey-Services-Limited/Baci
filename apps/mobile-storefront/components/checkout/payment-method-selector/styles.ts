import { StyleSheet } from 'react-native';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';

export const paymentMethodSelectorStyles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    minHeight: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabSeparator: {
    alignSelf: 'center',
    borderRadius: 1,
    height: 28,
    opacity: 0.7,
    width: StyleSheet.hairlineWidth,
  },
  activeTab: {
    shadowColor: BRAND.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  compactTab: {
    minHeight: 40,
    paddingVertical: 7,
    paddingHorizontal: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  compactTabText: {
    fontSize: 13,
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
});
