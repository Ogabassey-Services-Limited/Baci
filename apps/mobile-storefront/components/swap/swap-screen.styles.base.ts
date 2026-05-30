import { BRAND, RADIUS, SPACING } from '@/constants/Colors';

export const swapScreenBaseStyleDefinitions = {
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
  header: {
    paddingHorizontal: SPACING.md,
    marginTop: 0,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
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
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    opacity: 0.8,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  heroButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  stepsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  stepCard: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  stepIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${BRAND.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  stepDesc: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  eligibleCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  eligibleTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  eligibleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  eligibleCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eligibleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sustainabilityCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  sustainabilityIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sustainabilityContent: {
    flex: 1,
  },
  sustainabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  sustainabilityTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sustainabilityText: {
    fontSize: 12,
    lineHeight: 18,
  },
} as const;
