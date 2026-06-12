import { StyleSheet } from 'react-native';
import { SPACING } from '@/constants/Colors';
import type { ThemeColors } from '@/hooks/useTheme';

const footerBaseStyles = StyleSheet.create({
  container: {
    paddingTop: SPACING.xl,
    paddingBottom: 100, // Account for tab bar height + safe area
    paddingHorizontal: SPACING.lg,
  },
  brandSection: {
    marginBottom: SPACING.xl,
  },
  tagline: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    lineHeight: 16,
    maxWidth: 220,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    padding: 4,
  },
  socialPressed: {
    opacity: 0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.xl,
    gap: 40,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    marginBottom: 12,
    letterSpacing: 1,
  },
  linkItem: {
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  contactSection: {
    marginBottom: SPACING.lg,
  },
  contactList: {
    gap: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  contactText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    flex: 1,
    lineHeight: 16,
  },
  securedSection: {
    marginBottom: SPACING.lg,
  },
  securedByText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
  },
  bottomBar: {
    borderTopWidth: 1,
    paddingTop: SPACING.md,
    marginTop: SPACING.sm,
  },
  copyright: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});

export const getFooterStyles = (colors: ThemeColors) => ({
  container: [footerBaseStyles.container, { backgroundColor: colors.card }],
  brandSection: footerBaseStyles.brandSection,
  tagline: [footerBaseStyles.tagline, { color: colors.textSecondary }],
  socialRow: footerBaseStyles.socialRow,
  socialButton: footerBaseStyles.socialButton,
  socialPressed: footerBaseStyles.socialPressed,
  gridContainer: footerBaseStyles.gridContainer,
  column: footerBaseStyles.column,
  columnTitle: [footerBaseStyles.columnTitle, { color: colors.text }],
  linkItem: footerBaseStyles.linkItem,
  linkText: [footerBaseStyles.linkText, { color: colors.textSecondary }],
  contactSection: footerBaseStyles.contactSection,
  contactList: footerBaseStyles.contactList,
  contactItem: footerBaseStyles.contactItem,
  contactText: [footerBaseStyles.contactText, { color: colors.textSecondary }],
  securedSection: footerBaseStyles.securedSection,
  securedByText: [
    footerBaseStyles.securedByText,
    { color: colors.mutedForeground },
  ],
  badgesRow: footerBaseStyles.badgesRow,
  badge: [footerBaseStyles.badge, { backgroundColor: colors.background }],
  badgeText: [footerBaseStyles.badgeText, { color: colors.text }],
  bottomBar: [footerBaseStyles.bottomBar, { borderTopColor: colors.border }],
  copyright: [footerBaseStyles.copyright, { color: colors.mutedForeground }],
});
