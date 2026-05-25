import { Platform, StyleSheet } from 'react-native';
import { BRAND, palette, RADIUS, SPACING, withAlpha } from '@/constants/Colors';
import type { useTheme } from '@/hooks/useTheme';
import { getEliteHeroCardShadowStyle } from './Hero.shadows';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

export const ELITE_HEIGHT = 220;

export const getHeroStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    slide: { position: 'relative', overflow: 'hidden' },
    imageWrapper: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
    imageContainer: {
      height: '100%',
    },
    slideImage: { width: '100%', height: '100%' },
    gradient: { position: 'absolute', inset: 0 },
    eliteSlideContainer: {
      height: ELITE_HEIGHT,
      paddingHorizontal: SPACING.md,
      marginTop: 0,
      paddingBottom: SPACING.lg,
    },
    eliteCard: {
      flex: 1,
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
      position: 'relative',
      backgroundColor: colors.card,
      ...getEliteHeroCardShadowStyle(
        Platform.OS === 'web' ? 'web' : 'native'
      ),
    },
    eliteCardContent: {
      flex: 1,
      flexDirection: 'row',
      padding: SPACING.lg,
    },
    eliteTextColumn: {
      flex: 0.6,
      justifyContent: 'center',
      gap: 8,
      zIndex: 2,
    },
    eliteImageColumn: {
      flex: 0.4,
      justifyContent: 'center',
      alignItems: 'center',
    },
    eliteProductImage: {
      width: '120%',
      height: '120%',
      transform: [{ rotate: '-12deg' }, { translateX: 10 }, { translateY: 5 }],
    },
    eliteTitle: {
      fontSize: 24,
      fontFamily: 'Inter_900Black',
      color: colors.text,
      textAlign: 'left',
      lineHeight: 28,
    },
    eliteSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'left',
      fontFamily: 'serif',
      lineHeight: 16,
      marginBottom: 8,
    },
    eliteCta: {
      alignSelf: 'flex-start',
      backgroundColor: colors.muted,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      borderColor: colors.border,
    },
    eliteCtaText: {
      fontWeight: '700',
      color: colors.text,
      fontSize: 12,
      fontFamily: 'serif',
    },
    fashionContent: { flex: 1, justifyContent: 'flex-end', padding: 32 },
    fashionTitle: {
      fontSize: 32,
      fontWeight: '300',
      color: palette.white,
      marginBottom: 16,
      letterSpacing: 1,
    },
    fashionCta: { alignSelf: 'flex-start' },
    fashionCtaText: {
      color: palette.white,
      fontWeight: '600',
      fontSize: 16,
      textDecorationLine: 'underline',
    },
    standardContent: { flex: 1, justifyContent: 'center', padding: 20 },
    standardTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: palette.white,
      marginBottom: 12,
    },
    standardCta: {
      backgroundColor: BRAND.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      alignSelf: 'flex-start',
    },
    standardCtaText: { color: palette.white, fontWeight: '700' },
    dotsContainer: {
      position: 'absolute',
      bottom: 20,
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark
        ? withAlpha(palette.white, 0.2)
        : withAlpha(palette.black, 0.1),
    },
    dotActive: { width: 20, backgroundColor: colors.text },
  });
