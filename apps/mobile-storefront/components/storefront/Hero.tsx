/**
 * Hero Carousel Component - Multi-Tenant Template System
 * Supports 'parallax', 'carousel', and 'standard' variants
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
type ThemeColors = ReturnType<typeof useTheme>['colors'];
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';

const ELITE_HEIGHT = 220; // Wide horizontal rectangle matching web parity
const CAROUSEL_HEIGHT = 450;
const STANDARD_HEIGHT = 220;

export interface HeroSlide {
  title: string;
  subtitle: string;
  image: string;
  ctaText: string;
  ctaLink: Href;
}

interface HeroProps {
  slides?: HeroSlide[];
  autoplayDelay?: number;
}

const DEFAULT_SLIDES: HeroSlide[] = [];

// Default Blurhash for hero images (neutral gradient)
const DEFAULT_HERO_BLURHASH = 'L6PZfSi_.AyE_3t7t7RjE1%MWBR*';

// 2026 Best Practice: Common image props for offline caching
const heroImageProps = {
  placeholder: { blurhash: DEFAULT_HERO_BLURHASH },
  transition: 300,
  cachePolicy: 'memory-disk' as const, // Persist images for offline viewing
};

// --- SUB-COMPONENT: Elite Web-Alike Slide ---
const EliteSlide = ({
  item,
  screenWidth,
  colors,
  isDark,
  styles,
}: {
  item: HeroSlide;
  screenWidth: number;
  colors: ThemeColors;
  isDark: boolean;
  styles: ReturnType<typeof getStyles>;
}) => {
  return (
    <View style={[styles.eliteSlideContainer, { width: screenWidth }]}>
      <View style={styles.eliteCard}>
        {/* Background Image/Gradient - mocked as light gradient for now */}
        <LinearGradient
          colors={isDark ? [colors.card, colors.background] : [colors.muted, colors.border]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.eliteCardContent}>
          <View style={styles.eliteTextColumn}>
            <Text style={styles.eliteTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.eliteSubtitle} numberOfLines={3}>
              {item.subtitle}
            </Text>
            <Pressable
              style={styles.eliteCta}
              onPress={() => router.push(item.ctaLink)}
              accessibilityLabel={item.ctaText}
              accessibilityRole="button"
            >
              <Text style={styles.eliteCtaText}>{item.ctaText}</Text>
            </Pressable>
          </View>

          <View style={styles.eliteImageColumn}>
            <Image
              source={{ uri: item.image }}
              style={styles.eliteProductImage}
              contentFit="contain"
              {...heroImageProps}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

// --- SUB-COMPONENT: Fashion Carousel Slide ---
const FashionSlide = ({
  item,
  screenWidth,
  styles,
}: {
  item: HeroSlide;
  screenWidth: number;
  styles: ReturnType<typeof getStyles>;
}) => (
  <View style={[styles.slide, { width: screenWidth, height: CAROUSEL_HEIGHT }]}>
    <Image
      source={{ uri: item.image }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      {...heroImageProps}
    />
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.8)']}
      style={styles.gradient}
    />
    <View style={styles.fashionContent}>
      <Text style={styles.fashionTitle}>{item.title}</Text>
      <Pressable
        style={styles.fashionCta}
        onPress={() => router.push(item.ctaLink)}
        accessibilityLabel={item.ctaText}
        accessibilityRole="link"
      >
        <Text style={styles.fashionCtaText}>{item.ctaText} →</Text>
      </Pressable>
    </View>
  </View>
);

// --- SUB-COMPONENT: Standard Banner Slide ---
const StandardSlide = ({
  item,
  screenWidth,
  styles,
}: {
  item: HeroSlide;
  screenWidth: number;
  styles: ReturnType<typeof getStyles>;
}) => (
  <View
    style={[
      styles.slide,
      { width: screenWidth, height: STANDARD_HEIGHT, padding: SPACING.md },
    ]}
  >
    <Image
      source={{ uri: item.image }}
      style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xl }]}
      contentFit="cover"
      {...heroImageProps}
    />
    <LinearGradient
      colors={['rgba(0,0,0,0.7)', 'transparent']}
      style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xl }]}
    />
    <View style={styles.standardContent}>
      <Text style={styles.standardTitle}>{item.title}</Text>
      <Pressable
        style={styles.standardCta}
        onPress={() => router.push(item.ctaLink)}
        accessibilityLabel={item.ctaText}
        accessibilityRole="button"
      >
        <Text style={styles.standardCtaText}>{item.ctaText}</Text>
      </Pressable>
    </View>
  </View>
);

export function Hero({
  slides = DEFAULT_SLIDES,
  autoplayDelay = 5000,
}: HeroProps) {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const { width: screenWidth } = useWindowDimensions();
  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<Animated.FlatList<HeroSlide>>(null);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.set(event.contentOffset.x);
    },
  });

  const getHeroHeight = () => {
    if (template.heroVariant === 'parallax') return ELITE_HEIGHT;
    if (template.heroVariant === 'carousel') return CAROUSEL_HEIGHT;
    return STANDARD_HEIGHT;
  };

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % slides.length;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }, autoplayDelay);
    return () => clearInterval(interval);
  }, [currentIndex, slides.length, autoplayDelay]);

  // Don't render if no slides available (prevents "New Collection" placeholder flash)
  if (slides.length === 0) return null;

  const renderSlide = ({ item }: { item: HeroSlide }) => {
    switch (template.heroVariant) {
      case 'parallax':
        return <EliteSlide item={item} screenWidth={screenWidth} colors={colors} isDark={isDark} styles={styles} />;
      case 'carousel':
        return <FashionSlide item={item} screenWidth={screenWidth} styles={styles} />;
      default:
        return <StandardSlide item={item} screenWidth={screenWidth} styles={styles} />;
    }
  };

  return (
    <View style={{ height: getHeroHeight() }}>
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(_, index) => index.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={(e) =>
          setCurrentIndex(
            Math.round(e.nativeEvent.contentOffset.x / screenWidth)
          )
        }
        scrollEventThrottle={16}
        bounces={false}
      />
      {slides.length > 1 && (
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, currentIndex === index && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  slide: { position: 'relative', overflow: 'hidden' },
  imageWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  imageContainer: {
    height: '100%',
  },
  slideImage: { width: '100%', height: '100%' },
  gradient: { position: 'absolute', inset: 0 },

  // Elite Web-Alike Styles
  eliteSlideContainer: {
    height: ELITE_HEIGHT,
    paddingHorizontal: SPACING.md,
    marginTop: 0, // Removed negative margin to sit BELOW searchbar
    paddingBottom: SPACING.lg, // Space for dots
  },
  eliteCard: {
    flex: 1,
    borderRadius: RADIUS.xl, // 24px or similar
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  eliteCardContent: {
    flex: 1,
    flexDirection: 'row',
    padding: SPACING.lg, // 24px
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
    width: '120%', // Refined for horizontal aspect
    height: '120%',
    transform: [{ rotate: '-12deg' }, { translateX: 10 }, { translateY: 5 }],
  },
  eliteTitle: {
    fontSize: 24, // Optimized for horizontal layout
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
    backgroundColor: colors.primaryForeground,
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

  // Fashion
  fashionContent: { flex: 1, justifyContent: 'flex-end', padding: 32 },
  fashionTitle: {
    fontSize: 32,
    fontWeight: '300',
    color: '#FFF',
    marginBottom: 16,
    letterSpacing: 1,
  },
  fashionCta: { alignSelf: 'flex-start' },
  fashionCtaText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
    textDecorationLine: 'underline',
  },

  // Standard
  standardContent: { flex: 1, justifyContent: 'center', padding: 20 },
  standardTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 12,
  },
  standardCta: {
    backgroundColor: BRAND.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignSelf: 'flex-start',
  },
  standardCtaText: { color: '#FFF', fontWeight: '700' },

  // Common
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
  },
  dotActive: { width: 20, backgroundColor: colors.text },
});
