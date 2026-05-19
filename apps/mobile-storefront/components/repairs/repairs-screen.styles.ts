import { StyleSheet } from 'react-native';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';

export const repairsScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },

  heroCard: {
    backgroundColor: BRAND.primary,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: SPACING.md,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  heroButton: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  heroButtonText: {
    color: BRAND.primary,
    fontSize: 15,
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },

  stepsContainer: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  stepIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${BRAND.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    lineHeight: 17,
  },

  servicesList: {
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
  },
  serviceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: `${BRAND.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceContent: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  serviceDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  servicePriceBadge: {
    backgroundColor: `${BRAND.primary}15`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  servicePriceText: {
    color: BRAND.primary,
    fontSize: 11,
    fontWeight: '700',
  },

  freeBanner: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    alignItems: 'flex-start',
  },
  freeBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  freeBannerContent: {
    flex: 1,
  },
  freeBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  freeBannerDesc: {
    fontSize: 12,
    lineHeight: 18,
  },

  tradeinCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  tradeinContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  tradeinText: {
    flex: 1,
  },
  tradeinTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  tradeinDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  tradeinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: BRAND.primary,
  },
  tradeinButtonText: {
    color: BRAND.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
