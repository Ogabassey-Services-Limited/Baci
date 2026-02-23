import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeImage } from '@/components/ui/SafeImage';
import { RADIUS, SPACING } from '@/constants/Colors';
import type { HeroSlide } from './Hero';

const ELITE_HEIGHT = 220;

const heroImageProps = {
  placeholder: { blurhash: 'L6PZfSi_.AyE_3t7t7RjE1%MWBR*' },
  transition: 300,
  cachePolicy: 'memory-disk' as const,
};

export function EliteSlide({
  item,
  screenWidth,
}: {
  item: HeroSlide;
  screenWidth: number;
}) {
  return (
    <View style={[styles.eliteSlideContainer, { width: screenWidth }]}>
      <View style={styles.eliteCard}>
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
              onPress={() => router.push(item.ctaLink)}
              accessibilityLabel={item.ctaText}
              accessibilityRole="button"
            >
              <Text style={styles.eliteCtaText}>{item.ctaText}</Text>
            </Pressable>
          </View>

          <View style={styles.eliteImageColumn}>
            <SafeImage
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
}

export { ELITE_HEIGHT };

const styles = StyleSheet.create({
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
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    color: '#111',
    textAlign: 'left',
    lineHeight: 28,
  },
  eliteSubtitle: {
    fontSize: 12,
    color: '#4B5563',
    textAlign: 'left',
    fontFamily: 'serif',
    lineHeight: 16,
    marginBottom: 8,
  },
  eliteCta: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eliteCtaText: {
    fontWeight: '700',
    color: '#111',
    fontSize: 12,
    fontFamily: 'serif',
  },
});
