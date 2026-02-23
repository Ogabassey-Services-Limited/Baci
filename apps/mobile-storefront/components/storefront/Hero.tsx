/**
 * Hero Carousel Component - Multi-Tenant Template System
 * Supports 'parallax', 'carousel', and 'standard' variants
 */

import type { Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';
import { EliteSlide, ELITE_HEIGHT } from './EliteSlide';
import { FashionSlide, CAROUSEL_HEIGHT } from './FashionSlide';
import { StandardSlide, STANDARD_HEIGHT } from './StandardSlide';

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

export function Hero({
  slides = DEFAULT_SLIDES,
  autoplayDelay = 5000,
}: HeroProps) {
  const { width: screenWidth } = useWindowDimensions();
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

  // Don't render if no slides available (prevents "New Collection" placeholder flash)
  if (slides.length === 0) return null;

  const renderSlide = ({ item }: { item: HeroSlide }) => {
    switch (template.heroVariant) {
      case 'parallax':
        return <EliteSlide item={item} screenWidth={screenWidth} />;
      case 'carousel':
        return <FashionSlide item={item} screenWidth={screenWidth} />;
      default:
        return <StandardSlide item={item} screenWidth={screenWidth} />;
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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  dotActive: { width: 20, backgroundColor: '#111' },
});
