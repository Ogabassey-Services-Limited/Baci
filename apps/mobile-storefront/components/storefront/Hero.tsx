/**
 * Hero Carousel Component - Multi-Tenant Template System
 * Supports 'parallax', 'carousel', and 'standard' variants
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ELITE_HEIGHT = 280; // Compact card height
const CAROUSEL_HEIGHT = 450;
const STANDARD_HEIGHT = 220;

interface HeroSlide {
  title: string;
  subtitle: string;
  image: string;
  ctaText: string;
  ctaLink: string;
}

interface HeroProps {
  slides?: HeroSlide[];
  autoplayDelay?: number;
}

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    title: 'New Collection',
    subtitle: 'Discover the latest trends and styles for the season.',
    image: 'https://placehold.co/800x1000/F3F4F6/000000?text=New+Collection',
    ctaText: 'Shop Now',
    ctaLink: '/category/all',
  },
];

// --- SUB-COMPONENT: Elite Web-Alike Slide ---
const EliteSlide = ({ item }: { item: HeroSlide }) => {
  return (
    <View style={styles.eliteSlideContainer}>
      <View style={styles.eliteCard}>
        {/* Background Image/Gradient - mocked as light gradient for now */}
        <LinearGradient
          colors={['#F3F4F6', '#E5E7EB']}
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
              onPress={() => router.push(item.ctaLink as any)}
            >
              <Text style={styles.eliteCtaText}>{item.ctaText}</Text>
            </Pressable>
          </View>

          <View style={styles.eliteImageColumn}>
            <Image
              source={{ uri: item.image }}
              style={styles.eliteProductImage}
              contentFit="contain"
              transition={300}
            />
          </View>
        </View>
      </View>
    </View>
  );
};

// --- SUB-COMPONENT: Fashion Carousel Slide ---
const FashionSlide = ({ item }: { item: HeroSlide }) => (
  <View style={[styles.slide, { height: CAROUSEL_HEIGHT }]}>
    <Image
      source={{ uri: item.image }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
    />
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.5)']}
      style={styles.gradient}
    />
    <View style={styles.fashionContent}>
      <Text style={styles.fashionTitle}>{item.title}</Text>
      <Pressable
        style={styles.fashionCta}
        onPress={() => router.push(item.ctaLink as any)}
      >
        <Text style={styles.fashionCtaText}>{item.ctaText} →</Text>
      </Pressable>
    </View>
  </View>
);

// --- SUB-COMPONENT: Standard Banner Slide ---
const StandardSlide = ({ item }: { item: HeroSlide }) => (
  <View
    style={[styles.slide, { height: STANDARD_HEIGHT, padding: SPACING.md }]}
  >
    <Image
      source={{ uri: item.image }}
      style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xl }]}
      contentFit="cover"
    />
    <LinearGradient
      colors={['rgba(0,0,0,0.6)', 'transparent']}
      style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xl }]}
    />
    <View style={styles.standardContent}>
      <Text style={styles.standardTitle}>{item.title}</Text>
      <Pressable
        style={styles.standardCta}
        onPress={() => router.push(item.ctaLink as any)}
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
  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<Animated.FlatList<HeroSlide>>(null);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
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

  const renderSlide = ({ item, index }: { item: HeroSlide; index: number }) => {
    switch (template.heroVariant) {
      case 'parallax':
        return <EliteSlide item={item} />;
      case 'carousel':
        return <FashionSlide item={item} />;
      default:
        return <StandardSlide item={item} />;
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
            Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
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

const styles = StyleSheet.create({
  slide: { width: SCREEN_WIDTH, position: 'relative', overflow: 'hidden' },
  imageWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  imageContainer: {
    width: SCREEN_WIDTH * 1.3,
    height: '100%',
    left: -SCREEN_WIDTH * 0.15,
  },
  slideImage: { width: '100%', height: '100%' },
  gradient: { position: 'absolute', inset: 0 },

  // Elite Web-Alike Styles
  eliteSlideContainer: {
    width: SCREEN_WIDTH,
    height: ELITE_HEIGHT,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg, // Space for dots
  },
  eliteCard: {
    flex: 1,
    borderRadius: RADIUS.xl, // 24px or similar
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F3F4F6', // Fallback
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
    width: '140%', // Oversized for effect
    height: '140%',
    transform: [{ rotate: '-12deg' }, { translateX: 10 }, { translateY: 10 }],
  },
  eliteTitle: {
    fontSize: 26, // Large
    fontFamily: 'Inter_900Black',
    color: '#111',
    textAlign: 'left',
    lineHeight: 28,
  },
  eliteSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'left',
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
    marginBottom: 8,
  },
  eliteCta: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E7EB', // Light pill
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  eliteCtaText: {
    fontWeight: '700',
    color: '#111',
    fontSize: 12,
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
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: { width: 20, backgroundColor: '#FFF' },
});
