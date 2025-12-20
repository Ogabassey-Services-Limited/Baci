/**
 * Hero Carousel Component - Multi-Tenant Template System
 * Supports 'parallax', 'carousel', and 'standard' variants
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedScrollHandler, 
  useAnimatedStyle, 
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { BRAND, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/Colors';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ELITE_HEIGHT = 400;
const CAROUSEL_HEIGHT = 450; // Taller for fashion
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
  }
];

// --- SUB-COMPONENT: Elite Parallax Slide ---
const EliteSlide = ({ item, index, scrollX }: { item: HeroSlide, index: number, scrollX: Animated.SharedValue<number> }) => {
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH],
      [-SCREEN_WIDTH * 0.3, 0, SCREEN_WIDTH * 0.3],
      Extrapolate.CLAMP
    );
    return { transform: [{ translateX }] };
  });

  return (
    <View style={[styles.slide, { height: ELITE_HEIGHT }]}>
      <View style={styles.imageWrapper}>
        <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
          <Image source={{ uri: item.image }} style={styles.slideImage} contentFit="cover" transition={500} />
        </Animated.View>
      </View>
      <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']} style={styles.gradient} />
      <View style={styles.eliteContent}>
        <Text style={styles.eliteTitle}>{item.title}</Text>
        <Text style={styles.eliteSubtitle} numberOfLines={2}>{item.subtitle}</Text>
        <Pressable style={styles.eliteCta} onPress={() => router.push(item.ctaLink as any)}>
          <Text style={styles.eliteCtaText}>{item.ctaText}</Text>
        </Pressable>
      </View>
    </View>
  );
};

// --- SUB-COMPONENT: Fashion Carousel Slide ---
const FashionSlide = ({ item }: { item: HeroSlide }) => (
  <View style={[styles.slide, { height: CAROUSEL_HEIGHT }]}>
    <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={styles.gradient} />
    <View style={styles.fashionContent}>
      <Text style={styles.fashionTitle}>{item.title}</Text>
      <Pressable style={styles.fashionCta} onPress={() => router.push(item.ctaLink as any)}>
        <Text style={styles.fashionCtaText}>{item.ctaText} →</Text>
      </Pressable>
    </View>
  </View>
);

// --- SUB-COMPONENT: Standard Banner Slide ---
const StandardSlide = ({ item }: { item: HeroSlide }) => (
  <View style={[styles.slide, { height: STANDARD_HEIGHT, padding: SPACING.md }]}>
    <Image source={{ uri: item.image }} style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xl }]} contentFit="cover" />
    <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xl }]} />
    <View style={styles.standardContent}>
      <Text style={styles.standardTitle}>{item.title}</Text>
      <Pressable style={styles.standardCta} onPress={() => router.push(item.ctaLink as any)}>
        <Text style={styles.standardCtaText}>{item.ctaText}</Text>
      </Pressable>
    </View>
  </View>
);

export function Hero({ slides = DEFAULT_SLIDES, autoplayDelay = 5000 }: HeroProps) {
  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<Animated.FlatList<HeroSlide>>(null);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => { scrollX.value = event.contentOffset.x; },
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

  const renderSlide = ({ item, index }: { item: HeroSlide, index: number }) => {
    switch (template.heroVariant) {
      case 'parallax':
        return <EliteSlide item={item} index={index} scrollX={scrollX} />;
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
        onMomentumScrollEnd={(e) => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
        scrollEventThrottle={16}
        bounces={false}
      />
      {slides.length > 1 && (
        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View key={index} style={[styles.dot, currentIndex === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { width: SCREEN_WIDTH, position: 'relative', overflow: 'hidden' },
  imageWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  imageContainer: { width: SCREEN_WIDTH * 1.3, height: '100%', left: -SCREEN_WIDTH * 0.15 },
  slideImage: { width: '100%', height: '100%' },
  gradient: { position: 'absolute', inset: 0 },
  
  // Elite
  eliteContent: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 60, paddingHorizontal: 32 },
  eliteTitle: { fontSize: TYPOGRAPHY.size.hero, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 8 },
  eliteSubtitle: { fontSize: TYPOGRAPHY.size.base, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginBottom: 24 },
  eliteCta: { backgroundColor: '#FFF', paddingHorizontal: 32, paddingVertical: 12, borderRadius: RADIUS.full },
  eliteCtaText: { fontWeight: '700', color: '#000' },

  // Fashion
  fashionContent: { flex: 1, justifyContent: 'flex-end', padding: 32 },
  fashionTitle: { fontSize: 32, fontWeight: '300', color: '#FFF', marginBottom: 16, letterSpacing: 1 },
  fashionCta: { alignSelf: 'flex-start' },
  fashionCtaText: { color: '#FFF', fontWeight: '600', fontSize: 16, textDecorationLine: 'underline' },

  // Standard
  standardContent: { flex: 1, justifyContent: 'center', padding: 20 },
  standardTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 12 },
  standardCta: { backgroundColor: BRAND.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.md, alignSelf: 'flex-start' },
  standardCtaText: { color: '#FFF', fontWeight: '700' },

  // Common
  dotsContainer: { position: 'absolute', bottom: 20, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 20, backgroundColor: '#FFF' },
});