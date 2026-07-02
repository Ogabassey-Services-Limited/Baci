import { StyleSheet } from 'react-native';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';

export const serviceStyles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  sectionMeta: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  brandFilterScroll: {
    flexGrow: 0,
    marginBottom: SPACING.sm,
  },
  brandFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  brandFilterChip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
  },
  brandFilterText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  tierGrid: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
  },
  tierIcon: {
    width: 26,
    textAlign: 'center',
  },
  tierBody: {
    flex: 1,
    gap: 2,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  expandServicesButton: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  expandServicesText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recommendedText: {
    color: BRAND.onPrimary,
    fontSize: 8,
    fontWeight: '700',
  },
  tierName: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    flexShrink: 1,
  },
  tierTagline: {
    fontSize: 11,
  },
  tierPrice: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  tierInfoButton: {
    padding: 2,
  },
  featuresContainer: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  featuresLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  featuresDetail: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: SPACING.sm,
  },
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  featureText: {
    fontSize: 11,
  },
});
