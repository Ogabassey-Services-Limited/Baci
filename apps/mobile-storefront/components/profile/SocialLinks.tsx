import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SPACING } from '@/constants/Colors';
import { normalizeSocialUrl, type SocialPlatform } from '@/lib/social';

interface SocialLinksProps {
  socialMedia: Record<string, string>;
  phone?: string;
  colors: { textSecondary: string };
}

const PLATFORM_CONFIG: Record<
  string,
  { icon: string; color: string; label: string }
> = {
  instagram: { icon: 'logo-instagram', color: '#E1306C', label: 'Instagram' },
  tiktok: { icon: 'logo-tiktok', color: '#010101', label: 'TikTok' },
  twitter: { icon: 'logo-twitter', color: '#1DA1F2', label: 'Twitter' },
  facebook: { icon: 'logo-facebook', color: '#1877F2', label: 'Facebook' },
  youtube: { icon: 'logo-youtube', color: '#FF0000', label: 'YouTube' },
  snapchat: { icon: 'logo-snapchat', color: '#FFFC00', label: 'Snapchat' },
  linkedin: { icon: 'logo-linkedin', color: '#0A66C2', label: 'LinkedIn' },
};

export function SocialLinks({ socialMedia, phone, colors }: SocialLinksProps) {
  // Clean phone and normalize Nigerian local numbers (0→234) for wa.me API
  let cleanedPhone = phone ? phone.replace(/\D/g, '') : '';
  if (cleanedPhone.startsWith('0') && cleanedPhone.length === 11) {
    cleanedPhone = `234${cleanedPhone.slice(1)}`;
  }

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
    label: string;
  }[];

  if (items.length === 0 && !cleanedPhone) return null;

  return (
    <Animated.View
      entering={FadeInDown.delay(600).duration(500)}
      style={styles.container}
    >
      <Text style={[styles.title, { color: colors.textSecondary }]}>
        Join Our Community
      </Text>
      <View style={styles.row}>
        {items.map((item) => (
          <Pressable
            key={item.platform}
            style={({ pressed }) => [
              styles.btn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
            onPress={async () => {
              try {
                await Linking.openURL(item.url);
              } catch (e) {
                console.warn('Failed to open URL:', e);
              }
            }}
            accessibilityRole="link"
            accessibilityLabel={`Visit our ${item.platform} page`}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={
                  item.icon as React.ComponentProps<typeof Ionicons>['name']
                }
                size={26}
                color={item.color}
              />
            </View>
            <Text style={[styles.label, { color: item.color }]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
        {cleanedPhone && (
          <Pressable
            key="whatsapp"
            style={({ pressed }) => [
              styles.btn,
              pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
            ]}
            onPress={async () => {
              try {
                await Linking.openURL(`https://wa.me/${cleanedPhone}`);
              } catch (e) {
                console.warn('Failed to open URL:', e);
              }
            }}
            accessibilityRole="link"
            accessibilityLabel="Chat on WhatsApp"
          >
            <View style={styles.iconContainer}>
              <Ionicons name="logo-whatsapp" size={26} color="#25D366" />
            </View>
            <Text style={[styles.label, { color: '#25D366' }]}>WhatsApp</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 16,
  },
  btn: {
    alignItems: 'center',
    minWidth: 50,
  },
  iconContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
