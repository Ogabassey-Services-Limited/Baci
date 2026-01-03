/**
 * Footer Component
 * Matches Baci web app storefront footer
 * Dark background (#1a1a1a) with white text
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BRAND, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/Colors';

interface SocialLink {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  url: string;
}

const SOCIAL_LINKS: SocialLink[] = [
  { name: 'Instagram', icon: 'logo-instagram', url: 'https://instagram.com/ogabassey' },
  { name: 'Facebook', icon: 'logo-facebook', url: 'https://facebook.com/ogabassey' },
  { name: 'TikTok', icon: 'logo-tiktok', url: 'https://tiktok.com/@ogabassey' },
  { name: 'Twitter', icon: 'logo-twitter', url: 'https://twitter.com/ogabassey' },
];

interface FooterLink {
  label: string;
  url: string;
}

const QUICK_LINKS: FooterLink[] = [
  { label: 'Shop All', url: '/category/all' },
  { label: 'iPhones', url: '/category/iphones' },
  { label: 'Samsung', url: '/category/samsung' },
  { label: 'Laptops', url: '/category/laptops' },
];

const SUPPORT_LINKS: FooterLink[] = [
  { label: 'FAQ', url: '/faq' },
  { label: 'Shipping & Returns', url: '/shipping' },
  { label: 'Contact Us', url: '/contact' },
];

export function Footer() {
  const handleSocialPress = (url: string) => {
    Linking.openURL(url);
  };

  const currentYear = new Date().getFullYear();

  return (
    <View style={styles.container}>
      {/* Brand Section */}
      <View style={styles.brandSection}>
        <Text style={styles.logoText}>Ogabassey</Text>
        <Text style={styles.tagline}>Making Smartphones Accessible and Affordable</Text>

        {/* Social Icons */}
        <View style={styles.socialRow}>
          {SOCIAL_LINKS.map((social) => (
            <Pressable
              key={social.name}
              style={({ pressed }) => [styles.socialButton, pressed && styles.socialPressed]}
              onPress={() => handleSocialPress(social.url)}
            >
              <Ionicons name={social.icon} size={20} color="#9CA3AF" />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Links Section */}
      <View style={styles.linksRow}>
        {/* Shop Links */}
        <View style={styles.linkColumn}>
          <Text style={styles.linkHeading}>Shop</Text>
          {QUICK_LINKS.map((link) => (
            <Pressable key={link.label} style={styles.linkItem}>
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Support Links */}
        <View style={styles.linkColumn}>
          <Text style={styles.linkHeading}>Support</Text>
          {SUPPORT_LINKS.map((link) => (
            <Pressable key={link.label} style={styles.linkItem}>
              <Text style={styles.linkText}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.copyright}>© {currentYear} Ogabassey. All rights reserved.</Text>
        <View style={styles.legalLinks}>
          <Pressable>
            <Text style={styles.legalText}>Privacy</Text>
          </Pressable>
          <Text style={styles.legalDivider}>·</Text>
          <Pressable>
            <Text style={styles.legalText}>Terms</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING['2xl'],
    paddingHorizontal: SPACING.md,
  },
  // Brand Section
  brandSection: {
    marginBottom: SPACING.lg,
  },
  logoText: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  tagline: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
    marginBottom: SPACING.md,
  },
  socialRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  socialButton: {
    padding: SPACING.xs,
  },
  socialPressed: {
    opacity: 0.6,
  },
  // Links Section
  linksRow: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  linkColumn: {
    flex: 1,
  },
  linkHeading: {
    fontSize: TYPOGRAPHY.size.base,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginBottom: SPACING.sm,
  },
  linkItem: {
    paddingVertical: SPACING.xs,
  },
  linkText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_400Regular',
    color: '#9CA3AF',
  },
  // Bottom Bar
  bottomBar: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: SPACING.md,
  },
  copyright: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
    marginBottom: SPACING.xs,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legalText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'Inter_400Regular',
    color: '#6B7280',
  },
  legalDivider: {
    color: '#6B7280',
    marginHorizontal: SPACING.sm,
  },
});
