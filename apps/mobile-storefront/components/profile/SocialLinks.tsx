/**
 * Social Links Component
 * Horizontal scrollable row of branded social media icon buttons
 */

import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SPACING } from '@/constants/Colors';
import { normalizeSocialUrl, type SocialPlatform } from '@/lib/social';

interface SocialLinksProps {
  socialMedia: Record<string, string>;
  phone?: string;
  colors: { textSecondary: string };
}

const PLATFORM_CONFIG: Record<string, { icon: string; color: string }> = {
  instagram: { icon: 'logo-instagram', color: '#E1306C' },
  tiktok: { icon: 'logo-tiktok', color: '#010101' },
  twitter: { icon: 'logo-twitter', color: '#1DA1F2' },
  facebook: { icon: 'logo-facebook', color: '#1877F2' },
  youtube: { icon: 'logo-youtube', color: '#FF0000' },
  snapchat: { icon: 'logo-snapchat', color: '#FFFC00' },
  linkedin: { icon: 'logo-linkedin', color: '#0A66C2' },
};

export function SocialLinks({ socialMedia, phone, colors }: SocialLinksProps) {
  const items = Object.entries(socialMedia)
    .map(([platform, handle]) => {
      const config = PLATFORM_CONFIG[platform];
      if (!config) return null;
      const url = normalizeSocialUrl(handle, platform as SocialPlatform);
      if (!url) return null;
      return { platform, url, ...config };
    })
    .filter(Boolean) as {
    platform: string;
    url: string;
    icon: string;
    color: string;
  }[];

  if (items.length === 0 && !phone) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(600).duration(500)}
      style={styles.container}
    >
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        Connect With Us
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {items.map((item) => (
          <Pressable
            key={item.platform}
            style={({ pressed }) => [
              styles.btn,
              {
                backgroundColor: `${item.color}12`,
                borderColor: `${item.color}20`,
              },
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
            onPress={() => Linking.openURL(item.url)}
            accessibilityRole="link"
            accessibilityLabel={`Visit our ${item.platform} page`}
          >
            <Ionicons
              name={item.icon as React.ComponentProps<typeof Ionicons>['name']}
              size={22}
              color={item.color}
            />
          </Pressable>
        ))}
        {phone && (
          <Pressable
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: '#25D36612', borderColor: '#25D36620' },
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
            onPress={() =>
              Linking.openURL(
                `https://wa.me/${phone.replace(/\D/g, '') || '2348146978921'}`
              )
            }
            accessibilityRole="link"
            accessibilityLabel="Chat on WhatsApp"
          >
            <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          </Pressable>
        )}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    paddingLeft: SPACING.md,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginLeft: 4,
  },
  scroll: {
    gap: 10,
    paddingRight: SPACING.md,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
});
