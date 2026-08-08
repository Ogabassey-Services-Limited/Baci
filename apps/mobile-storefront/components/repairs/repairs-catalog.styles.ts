import { StyleSheet } from 'react-native';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';

/**
 * Shared styles for the device-first repairs catalogue screens (device
 * picker, device detail, booking form, success). Kept in one file so the
 * screens stay well under the 300-line cap and share a single visual system
 * with the legacy "Repair Lab" fallback (`repairs-screen.styles.ts`).
 */
export const repairsCatalogStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  heroCard: {
    borderRadius: RADIUS['3xl'],
    gap: SPACING.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    padding: SPACING.lg,
  },
  heroBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  heroDescription: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.78,
  },
  heroActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  heroPrimaryButtonBox: {
    backgroundColor: BRAND.primary,
    borderRadius: RADIUS.lg,
    flex: 1,
    overflow: 'hidden',
  },
  heroPrimaryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.sm,
  },
  heroPrimaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  heroSecondaryButtonBox: {
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroSecondaryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: SPACING.md,
  },
  heroSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  trustItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  trustText: {
    fontSize: 11,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },

  // Intro
  introTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  introSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  brandRail: {
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  brandRailContent: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  brandChip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  brandChipText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: SPACING.md,
  },

  // Brand groups
  brandGroup: {
    marginBottom: SPACING.lg,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  deviceThumb: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: `${BRAND.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
    minWidth: 0,
  },
  deviceModel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  deviceMeta: {
    fontSize: 12,
  },

  // Empty / not-listed
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  notListedCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  notListedTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  notListedDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: SPACING.xs,
  },
  careCard: {
    alignItems: 'center',
    borderRadius: RADIUS.xl,
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  careIcon: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  careCopy: {
    flex: 1,
    gap: SPACING.xs,
  },
  careTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  careText: {
    fontSize: 12,
    lineHeight: 17,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: BRAND.primary,
  },
  secondaryButtonText: {
    color: BRAND.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  // Quotes (device detail)
  deviceHeader: {
    marginBottom: SPACING.lg,
  },
  deviceHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  specsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  specChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: BRAND.primaryAlpha12,
  },
  specChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  quoteCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  quoteName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  quotePrice: {
    fontSize: 15,
    fontWeight: '800',
    color: BRAND.primary,
  },
  quoteMeta: {
    fontSize: 12,
    marginTop: SPACING.xs,
  },

  // Primary CTA
  primaryButton: {
    backgroundColor: BRAND.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.md,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
