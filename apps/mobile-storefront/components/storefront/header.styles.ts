import { StyleSheet } from 'react-native';
import { RADIUS, SPACING } from '@/constants/Colors';
import type { ThemeColors } from '@/hooks/useTheme';

const headerBaseStyles = StyleSheet.create({
  eliteContainer: {
    backgroundColor: 'transparent',
    paddingBottom: SPACING.md,
    borderBottomWidth: 0,
    zIndex: 10,
  },
  eliteContent: {
    flexDirection: 'column',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
    height: 44,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  menuBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
    marginLeft: -8, // Offset centering so menu icon aligns perfectly with SPACING.md (16px) left margin
  },
  logoContainer: {},
  logoText: {
    fontSize: 24,
    fontFamily: 'Inter_900Black',
    letterSpacing: -1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  searchRowActive: {
    paddingVertical: 2,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    gap: 12,
  },
  activeSearchPill: {
    borderWidth: 1.5,
  },
  searchPillPressable: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'serif',
    height: '100%',
    padding: 0,
  },
  searchPlaceholder: {
    fontSize: 15,
    fontFamily: 'serif',
    lineHeight: 20,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  minimalContainer: {
    backgroundColor: 'transparent',
    paddingBottom: SPACING.sm,
  },
  minimalContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  minimalLogoText: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  defaultContainer: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  defaultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  defaultLogoText: {
    fontSize: 20,
    fontWeight: '800',
  },
  defaultSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  defaultSearchPlaceholder: {
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  rightIconBtn: {
    marginRight: -8, // Offset centering so far-right icon aligns perfectly with SPACING.md (16px) right margin
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  extensionArea: {
    height: 80,
    width: '100%',
  },
});

export const getHeaderStyles = (colors: ThemeColors) => ({
  eliteContainer: headerBaseStyles.eliteContainer,
  santaText: { color: colors.foreground },
  eliteContent: headerBaseStyles.eliteContent,
  topRow: headerBaseStyles.topRow,
  leftGroup: headerBaseStyles.leftGroup,
  menuBtn: headerBaseStyles.menuBtn,
  logoContainer: headerBaseStyles.logoContainer,
  logoText: headerBaseStyles.logoText,
  searchRow: headerBaseStyles.searchRow,
  searchRowActive: headerBaseStyles.searchRowActive,
  searchPill: [headerBaseStyles.searchPill, { backgroundColor: colors.card }],
  activeSearchPill: [
    headerBaseStyles.activeSearchPill,
    { borderColor: colors.primary },
  ],
  searchPillPressable: headerBaseStyles.searchPillPressable,
  searchInput: headerBaseStyles.searchInput,
  santaSearchPill: { backgroundColor: colors.card },
  searchPlaceholder: [
    headerBaseStyles.searchPlaceholder,
    { color: colors.textSecondary },
  ],
  santaPlaceholder: { color: colors.textSecondary },
  cancelText: [headerBaseStyles.cancelText, { color: colors.foreground }],
  minimalContainer: headerBaseStyles.minimalContainer,
  minimalContent: headerBaseStyles.minimalContent,
  minimalLogoText: [headerBaseStyles.minimalLogoText, { color: colors.text }],
  defaultContainer: [
    headerBaseStyles.defaultContainer,
    { backgroundColor: colors.background },
  ],
  defaultTopRow: headerBaseStyles.defaultTopRow,
  defaultLogoText: [headerBaseStyles.defaultLogoText, { color: colors.text }],
  defaultSearchBar: [
    headerBaseStyles.defaultSearchBar,
    { backgroundColor: colors.muted },
  ],
  defaultSearchPlaceholder: [
    headerBaseStyles.defaultSearchPlaceholder,
    { color: colors.placeholder },
  ],
  actionRow: headerBaseStyles.actionRow,
  iconBtn: headerBaseStyles.iconBtn,
  rightIconBtn: headerBaseStyles.rightIconBtn,
  badge: [
    headerBaseStyles.badge,
    {
      backgroundColor: colors.primary,
      borderColor: colors.background,
    },
  ],
  badgeText: [headerBaseStyles.badgeText, { color: colors.primaryForeground }],
  extensionArea: [
    headerBaseStyles.extensionArea,
    { backgroundColor: colors.background },
  ],
});
