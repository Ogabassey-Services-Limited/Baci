import { StyleSheet } from 'react-native';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import type { useTheme } from '@/hooks/useTheme';

export type ThemeColors = ReturnType<typeof useTheme>['colors'];

export const getHeaderStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    eliteContainer: {
      backgroundColor: 'transparent',
      paddingBottom: SPACING.md,
      borderBottomWidth: 0,
      zIndex: 10,
    },
    santaText: {
      color: colors.foreground,
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
      backgroundColor: colors.card,
      height: 48,
      borderRadius: RADIUS.md,
      paddingHorizontal: 16,
      gap: 12,
    },
    activeSearchPill: {
      borderWidth: 1.5,
      borderColor: BRAND.primary,
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
    santaSearchPill: {
      backgroundColor: colors.card,
    },
    searchPlaceholder: {
      color: colors.textSecondary,
      fontSize: 15,
      fontFamily: 'serif',
      lineHeight: 20,
    },
    santaPlaceholder: {
      color: colors.textSecondary,
    },
    cancelText: {
      color: colors.foreground,
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
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },
    defaultContainer: {
      backgroundColor: colors.background,
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
      color: colors.text,
    },
    defaultSearchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: RADIUS.lg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    defaultSearchPlaceholder: {
      color: colors.placeholder,
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
    badge: {
      position: 'absolute',
      top: 2,
      right: 2,
      backgroundColor: BRAND.primary,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: '#FFF',
    },
    badgeText: {
      color: '#FFF',
      fontSize: 9,
      fontWeight: '900',
    },
    extensionArea: {
      height: 80,
      backgroundColor: colors.background,
      width: '100%',
    },
  });
