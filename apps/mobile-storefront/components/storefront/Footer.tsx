import Feather from "@react-native-vector-icons/feather/static";
import Ionicons from "@react-native-vector-icons/ionicons/static";
import { type Href, router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Logo } from '@/components/ui/Logo';
import { BRAND, SPACING } from '@/constants/Colors';
import { useMerchant } from '@/hooks';
import { createLogger } from '@/lib/logger';
import { normalizeSocialUrl, type SocialPlatform } from '@/lib/social';

const log = createLogger('Footer');

const MENU_LINKS = [
  { label: 'About Us', route: '/about' },
  { label: 'Repairs', route: '/repairs' },
  { label: 'IMEI Check', route: '/imei-check' },
];

const SUPPORT_LINKS = [
  { label: 'My Orders', route: '/orders' },
  { label: 'Help Center', route: '/faq' },
  { label: 'Saved Items', route: '/saved' },
];

export function Footer() {
  const { data: merchant } = useMerchant();
  const currentYear = new Date().getFullYear();

  const handleExternalLink = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback for web if app scheme not supported/installed
        await Linking.openURL(url);
      }
    } catch (err) {
      log.warn('External link error:', err);
      // Last resort fallback
      Linking.openURL(url);
    }
  };

  const socialMedia = merchant?.social_media || {};
  const socialLinks = Object.entries(socialMedia)
    .map(([platform, handle]) => {
      const url = normalizeSocialUrl(handle, platform as SocialPlatform);
      if (!url) return null;

      let icon: React.ComponentProps<typeof Ionicons>['name'];

      switch (platform) {
        case 'instagram':
          icon = 'logo-instagram';
          break;
        case 'tiktok':
          icon = 'logo-tiktok';
          break;
        case 'twitter':
          icon = 'logo-twitter'; // Still using twitter icon for X rebranding in Ionicons
          break;
        case 'facebook':
          icon = 'logo-facebook';
          break;
        case 'youtube':
          icon = 'logo-youtube';
          break;
        case 'snapchat':
          icon = 'logo-snapchat';
          break;
        case 'linkedin':
          icon = 'logo-linkedin';
          break;
        default:
          return null;
      }

      return { platform, handle, url, icon };
    })
    .filter((link): link is NonNullable<typeof link> => link !== null);

  const contactInfo = {
    address: merchant?.business_address || '2 Olaide Tomori St, Ikeja, Lagos',
    phone: merchant?.phone || '+234 814 697 8921',
    email: merchant?.email || 'support@ogabassey.com',
  };

  const handleInternalLink = (route: string) => {
    router.push(route as Href);
  };

  return (
    <View style={styles.container}>
      {/* Brand Section */}
      <View style={styles.brandSection}>
        <Logo width={100} height={20} color="white" />
        <Text style={styles.tagline}>
          Making Smartphones Accessible and Affordable
        </Text>
        <View style={styles.socialRow}>
          {socialLinks.map((social) => (
            <Pressable
              key={social.platform}
              style={({ pressed }) => [
                styles.socialButton,
                pressed && styles.socialPressed,
              ]}
              onPress={() => handleExternalLink(social.url)}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel={`Follow us on ${social.platform}`}
            >
              <Ionicons name={social.icon} size={18} color="#9CA3AF" />
            </Pressable>
          ))}
        </View>
      </View>
      {/* Links Grid */}
      <View style={styles.gridContainer}>
        {/* Menu Column */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>MENU</Text>
          {MENU_LINKS.map((link) => (
            <Pressable
              key={link.label}
              style={styles.linkItem}
              onPress={() => handleInternalLink(link.route)}
              accessibilityRole="link"
              accessibilityLabel={`Navigate to ${link.label}`}
            >
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Support Column */}
        <View style={styles.column}>
          <Text style={styles.columnTitle}>SUPPORT</Text>
          {SUPPORT_LINKS.map((link) => (
            <Pressable
              key={link.label}
              style={styles.linkItem}
              onPress={() => handleInternalLink(link.route)}
              accessibilityRole="link"
              accessibilityLabel={`Navigate to ${link.label}`}
            >
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {/* Contact Section */}
      <View style={styles.contactSection}>
        <Text style={styles.columnTitle}>CONTACT</Text>
        <View style={styles.contactList}>
          <View style={styles.contactItem}>
            <Feather name="map-pin" size={14} color={BRAND.primary} />
            <Text style={styles.contactText}>{contactInfo.address}</Text>
          </View>
          <Pressable
            style={styles.contactItem}
            onPress={() =>
              handleExternalLink(`tel:${contactInfo.phone.replace(/\s/g, '')}`)
            }
            accessibilityRole="link"
            accessibilityLabel={`Call us at ${contactInfo.phone}`}
          >
            <Feather name="phone" size={14} color={BRAND.primary} />
            <Text style={styles.contactText}>{contactInfo.phone}</Text>
          </Pressable>
          <Pressable
            style={styles.contactItem}
            onPress={() => handleExternalLink(`mailto:${contactInfo.email}`)}
            accessibilityRole="link"
            accessibilityLabel={`Email us at ${contactInfo.email}`}
          >
            <Feather name="mail" size={14} color={BRAND.primary} />
            <Text style={styles.contactText}>{contactInfo.email}</Text>
          </Pressable>
        </View>
      </View>
      {/* Secured By Section */}
      <View style={styles.securedSection}>
        <Text style={styles.securedByText}>Secured by:</Text>
        <View style={styles.badgesRow}>
          <View style={styles.badge}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-2h2v2zm0-4h-2V7h2v6z"
                fill="#2563EB"
              />
            </Svg>
            <Text style={styles.badgeText}>Paystack</Text>
          </View>
          <View style={styles.badge}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d="M12 2L2 22h10l10-20H12zm0 6l-5 10h10L12 8z"
                fill="#F97316"
              />
            </Svg>
            <Text style={styles.badgeText}>Flutterwave</Text>
          </View>
        </View>
      </View>
      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.copyright}>
          © {currentYear} Ogabassey Ltd. All rights reserved.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    paddingTop: SPACING.xl,
    paddingBottom: 100, // Account for tab bar height + safe area
    paddingHorizontal: SPACING.lg,
  },
  brandSection: {
    marginBottom: SPACING.xl,
  },
  tagline: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    lineHeight: 16,
    maxWidth: 220,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    padding: 4,
  },
  socialPressed: {
    opacity: 0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.xl,
    gap: 40,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: 1,
  },
  linkItem: {
    paddingVertical: 6,
  },
  linkText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
  },
  contactSection: {
    marginBottom: SPACING.lg,
  },
  contactList: {
    gap: 10,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  contactText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    flex: 1,
    lineHeight: 16,
  },
  securedSection: {
    marginBottom: SPACING.lg,
  },
  securedByText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: '#6B7280',
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#111827',
    letterSpacing: -0.3,
  },
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: SPACING.md,
    marginTop: SPACING.sm,
  },
  copyright: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
});
