import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeImage } from '@/components/ui/SafeImage';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import type { HeroSlide } from './Hero';

const STANDARD_HEIGHT = 220;

const heroImageProps = {
  placeholder: { blurhash: 'L6PZfSi_.AyE_3t7t7RjE1%MWBR*' },
  transition: 300,
  cachePolicy: 'memory-disk' as const,
};

export function StandardSlide({
  item,
  screenWidth,
}: {
  item: HeroSlide;
  screenWidth: number;
}) {
  return (
    <View
      style={[
        styles.slide,
        { width: screenWidth, height: STANDARD_HEIGHT, padding: SPACING.md },
      ]}
    >
      <SafeImage
        source={{ uri: item.image }}
        style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.xl }]}
        contentFit="cover"
        {...heroImageProps}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
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
}

export { STANDARD_HEIGHT };

const styles = StyleSheet.create({
  slide: { position: 'relative', overflow: 'hidden' },
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
});
