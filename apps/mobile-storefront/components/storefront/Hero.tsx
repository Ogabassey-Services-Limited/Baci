/** Multi-tenant hero carousel with parallax, carousel, and standard variants. */
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
import { palette, RADIUS, SPACING, withAlpha } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { CONFIG } from '@/lib/config';
import { createSafeBoundedImageSource } from '@/lib/safe-bounded-image-source';
import { getTemplateConfig } from '@/lib/templates';
import { ELITE_HEIGHT, getHeroStyles } from './Hero.styles';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

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
  autoplay: false,
};

function getHeroImageSource(uri: string, width: number, height: number) {
  return createSafeBoundedImageSource({ height, uri, width });
}

const getCoverHeroImageSource = (uri: string, width: number, height: number) =>
  createSafeBoundedImageSource({ fit: 'cover', height, uri, width });

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
  styles: ReturnType<typeof getHeroStyles>;
}) => {
  const imageSource = getHeroImageSource(
    item.image,
    screenWidth * 0.5,
    ELITE_HEIGHT
  );

  return (
    <View style={[styles.eliteSlideContainer, { width: screenWidth }]}>
      <View style={styles.eliteCard}>
        {/* Background Image/Gradient - mocked as light gradient for now */}
        <LinearGradient
          colors={
            isDark
              ? [colors.card, colors.background]
              : [colors.muted, colors.border]
          }
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
              source={imageSource}
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

const FashionSlide = ({
  item,
  screenWidth,
  styles,
}: {
  item: HeroSlide;
  screenWidth: number;
  styles: ReturnType<typeof getHeroStyles>;
}) => (
  <View style={[styles.slide, { width: screenWidth, height: CAROUSEL_HEIGHT }]}>
    <Image
      source={getCoverHeroImageSource(item.image, screenWidth, CAROUSEL_HEIGHT)}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      {...heroImageProps}
    />
    <LinearGradient
      colors={['transparent', withAlpha(palette.black, 0.8)]}
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

const StandardSlide = ({
  item,
  screenWidth,
  styles,
}: {
  item: HeroSlide;
  screenWidth: number;
  styles: ReturnType<typeof getHeroStyles>;
}) => (
  <View
    style={[
      styles.slide,
      { width: screenWidth, height: STANDARD_HEIGHT, padding: SPACING.md },
    ]}
  >
    <Image
      source={getCoverHeroImageSource(item.image, screenWidth, STANDARD_HEIGHT)}
      style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xl }]}
      contentFit="cover"
      {...heroImageProps}
    />
    <LinearGradient
      colors={[withAlpha(palette.black, 0.7), 'transparent']}
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
  const styles = getHeroStyles(colors, isDark);
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
        return (
          <EliteSlide
            item={item}
            screenWidth={screenWidth}
            colors={colors}
            isDark={isDark}
            styles={styles}
          />
        );
      case 'carousel':
        return (
          <FashionSlide item={item} screenWidth={screenWidth} styles={styles} />
        );
      default:
        return (
          <StandardSlide
            item={item}
            screenWidth={screenWidth}
            styles={styles}
          />
        );
    }
  };

  return (
    <View style={{ height: getHeroHeight() }}>
      <Animated.FlatList
        ref={flatListRef}
        getItemLayout={(_, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
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
