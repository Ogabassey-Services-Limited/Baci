import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeImage } from '@/components/ui/SafeImage';
import type { HeroSlide } from './Hero';

const CAROUSEL_HEIGHT = 450;

const heroImageProps = {
  placeholder: { blurhash: 'L6PZfSi_.AyE_3t7t7RjE1%MWBR*' },
  transition: 300,
  cachePolicy: 'memory-disk' as const,
};

export function FashionSlide({
  item,
  screenWidth,
}: {
  item: HeroSlide;
  screenWidth: number;
}) {
  return (
    <View style={[styles.slide, { width: screenWidth, height: CAROUSEL_HEIGHT }]}>
      <SafeImage
        source={{ uri: item.image }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        {...heroImageProps}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)']}
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
          <Text style={styles.fashionCtaText}>{item.ctaText} \u2192</Text>
        </Pressable>
      </View>
    </View>
  );
}

export { CAROUSEL_HEIGHT };

const styles = StyleSheet.create({
  slide: { position: 'relative', overflow: 'hidden' },
  gradient: { position: 'absolute', inset: 0 },
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
});
