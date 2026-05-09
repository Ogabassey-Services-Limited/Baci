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
  brandFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.md,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tierCard: {
    width: '48.8%',
    minHeight: 124,
    padding: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    justifyContent: 'space-between',
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
    position: 'absolute',
    top: -8,
    right: -8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: BRAND.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  recommendedText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
  },
  tierName: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    marginTop: SPACING.xs,
  },
  tierTagline: {
    fontSize: 10,
    marginTop: 2,
  },
  tierPrice: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    marginTop: SPACING.xs,
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
