/**
 * Header Component - Multi-Tenant Template System
 * Supports 'elite', 'standard', and 'minimal' styles
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Image } from 'expo-image';

import { BRAND, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/Colors';
import { CONFIG } from '@/lib/config';
import { getTemplateConfig } from '@/lib/templates';
import { useCartStore } from '@/stores/cart-store';
import { useThemeStore } from '@/stores/theme-store';
import { Logo } from '@/components/ui/Logo';

interface HeaderProps {
  showSearch?: boolean;
  onSearchPress?: () => void;
}

// Background pattern from web (SVG Data URI)
const PATTERN_URI = "data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.5'%3E%3C!-- Original items --%3E%3Cg transform='translate(20, 20) rotate(-15 6 10)'%3E%3Crect x='0' y='0' width='12' height='20' rx='2'/%3E%3Cline x1='4' y1='17' x2='8' y2='17' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(90, 15) rotate(10 10 7)'%3E%3Cpath d='M2 0 h16 v10 h-16 z M0 10 h20 v2 h-20 z'/%3E%3C/g%3E%3Cg transform='translate(25, 80) rotate(20 8 8)'%3E%3Cpath d='M0 10 v5 h4 v-5 a6 6 0 1 1 12 0 v5 h4 v-5'/%3E%3C/g%3E%3Cg transform='translate(75, 100) rotate(-10 6 6)'%3E%3Crect x='0' y='0' width='12' height='12' rx='3'/%3E%3Cpath d='M3 -3 v3 M9 -3 v3 M3 12 v3 M9 12 v3'/%3E%3C/g%3E%3Cg transform='translate(120, 90) rotate(5 9 6)'%3E%3Crect x='0' y='3' width='18' height='12' rx='2'/%3E%3Ccircle cx='9' cy='9' r='3'/%3E%3Crect x='2' y='0' width='4' height='3' rx='1'/%3E%3C/g%3E%3Cg transform='translate(70, 50) rotate(-25 10 6)'%3E%3Crect x='0' y='0' width='20' height='12' rx='6'/%3E%3Ccircle cx='6' cy='6' r='2'/%3E%3Ccircle cx='14' cy='6' r='2'/%3E%3C/g%3E%3Cg transform='translate(120, 40) rotate(35 8 10)'%3E%3Crect x='0' y='0' width='16' height='20' rx='2'/%3E%3C/g%3E%3C!-- New items for density --%3E%3Cg transform='translate(50, 15) rotate(45 5 5)'%3E%3Crect x='2' y='-2' width='6' height='14' rx='1'/%3E%3Crect x='0' y='2' width='10' height='6' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 55) rotate(15 5 8)'%3E%3Crect x='0' y='0' width='10' height='16' rx='5'/%3E%3Cline x1='5' y1='0' x2='5' y2='6'/%3E%3C/g%3E%3Cg transform='translate(45, 115) rotate(-10 6 8)'%3E%3Crect x='0' y='0' width='12' height='16' rx='1'/%3E%3Ccircle cx='6' cy='4' r='2'/%3E%3Ccircle cx='6' cy='11' r='3'/%3E%3C/g%3E%3Cg transform='translate(100, 75) rotate(30 6 6)'%3E%3Crect x='0' y='4' width='12' height='8' rx='2'/%3E%3Cpath d='M2 4 v-4 M10 4 v-4'/%3E%3C/g%3E%3Cg transform='translate(135, 125) rotate(-45 5 9)'%3E%3Crect x='0' y='0' width='10' height='18' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 120) rotate(0)'%3E%3Cpath d='M0 5 q5 -10 10 0 t10 0' stroke-linecap='round'/%3E%3C/g%3E%3C!-- Fillers --%3E%3Ccircle cx='60' cy='60' r='1.5' fill='%23ffffff'/%3E%3Cpath d='M90 130 l4 4 m-4 0 l4 -4' stroke-width='1'/%3E%3Ccircle cx='140' cy='20' r='2' stroke='none' fill='%23ffffff'/%3E%3Cpath d='M30 5 l3 3 m-3 0 l3 -3' stroke-width='1'/%3E%3Ccircle cx='80' cy='30' r='1'/%3E%3Ccircle cx='110' cy='110' r='1.5'/%3E%3C/g%3E%3C/svg%3E";

export function Header({ showSearch = true, onSearchPress }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const itemCount = useCartStore((state) => state.itemCount());
  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const theme = useThemeStore((state) => state.theme);

  const handleSearch = () => {
    if (onSearchPress) {
      onSearchPress();
    } else {
      router.push('/search');
    }
  };

  const storeName = Constants.expoConfig?.name || 'Baci Store';
  const isSanta = theme === 'santa';

  // --- RENDER: Elite Merged Layout (Electronics/High-Tech) ---
  if (template.headerStyle === 'elite' || isSanta) {
    return (
      <View style={[
        styles.eliteContainer,
        { paddingTop: insets.top + SPACING.sm },
        isSanta && styles.santaContainer
      ]}>
        {/* Santa Mode Background */}
        {isSanta && (
          <Image
            source={{ uri: PATTERN_URI }}
            style={[StyleSheet.absoluteFillObject, { opacity: 0.1 }]}
            contentFit="cover"
            transition={500}
          />
        )}

        <View style={styles.eliteContent}>
          {/* Row 1: Nav, Logo, Actions */}
          <View style={styles.topRow}>
            <View style={styles.leftGroup}>
              <Pressable onPress={() => { }} hitSlop={12} style={styles.menuBtn}>
                <Ionicons name="menu-outline" size={28} color="#FFF" />
              </Pressable>

              <Pressable onPress={() => router.push('/(tabs)')} style={styles.logoContainer}>
                <Logo width={140} height={25} color='white' />
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              {/* <Pressable onPress={() => router.push('/notifications' as any)} hitSlop={12} style={styles.iconBtn}>
                <Ionicons name="notifications-outline" size={24} color="#FFF" />
              </Pressable> */}
              {/* Note: Web view doesn't show bell in header usually, simplifying to match web if needed, 
                  but keeping specific user request "utility bar" separate. 
                  Let's keep Cart prominent as per standard e-commerce. */}
              <Pressable onPress={() => router.push('/(tabs)/cart')} hitSlop={12} style={styles.iconBtn}>
                <Ionicons name="cart-outline" size={26} color="#FFF" />
                {itemCount > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{itemCount}</Text></View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Row 2: Search Bar */}
          {showSearch && (
            <Pressable
              style={[styles.searchPill, isSanta && styles.santaSearchPill]}
              onPress={handleSearch}
              hitSlop={12}
            >
              <Ionicons name="search-outline" size={20} color={isSanta ? "#666" : "#999"} />
              <Text style={[styles.searchPlaceholder, isSanta && styles.santaPlaceholder]} numberOfLines={1}>
                Search products, brands and categories
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // --- RENDER: Minimal Layout (Fashion/Beauty) ---
  if (template.headerStyle === 'minimal') {
    return (
      <View style={[styles.minimalContainer, { paddingTop: insets.top + SPACING.sm }]}>
        <View style={styles.minimalContent}>
          <Text style={styles.minimalLogoText}>{storeName.split(' - ')[0]}</Text>
          <View style={styles.actionRow}>
            {showSearch && (
              <Pressable onPress={handleSearch} hitSlop={12} style={styles.iconBtn}>
                <Ionicons name="search-outline" size={24} color="#000" />
              </Pressable>
            )}
            <Pressable onPress={() => router.push('/(tabs)/cart')} hitSlop={12} style={styles.iconBtn}>
              <Ionicons name="bag-outline" size={24} color="#000" />
              {itemCount > 0 && (
                <View style={[styles.badge, { backgroundColor: '#000' }]}><Text style={styles.badgeText}>{itemCount}</Text></View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // --- RENDER: Standard Layout (Home Goods/Services) ---
  return (
    <View style={[styles.defaultContainer, { paddingTop: insets.top + SPACING.sm }]}>
      <View style={styles.defaultTopRow}>
        <Text style={styles.defaultLogoText}>{storeName.split(' - ')[0]}</Text>
        <View style={styles.actionRow}>
          <Pressable onPress={() => router.push('/notifications' as any)} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={24} color={BRAND.primary} />
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/cart')} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="cart-outline" size={24} color={BRAND.primary} />
            {itemCount > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{itemCount}</Text></View>
            )}
          </Pressable>
        </View>
      </View>
      {showSearch && (
        <Pressable style={styles.defaultSearchBar} onPress={handleSearch}>
          <Ionicons name="search" size={18} color="#999" />
          <Text style={styles.defaultSearchPlaceholder}>Search our collection...</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Elite Styles
  eliteContainer: {
    backgroundColor: '#000', // Deep black as per target
    paddingBottom: SPACING.md,
    borderBottomWidth: 0,
  },
  santaContainer: {
    backgroundColor: '#0F0F0F',
    overflow: 'hidden',
  },
  santaText: {
    color: '#FFF',
  },
  eliteContent: {
    flexDirection: 'column', // Changed from row to column
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
    zIndex: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4, // Slight spacing before search
    height: 44, // Nav height
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  menuBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  logoContainer: {
    // No margin right needed if in group
  },
  logoText: {
    fontSize: 24, // Larger
    fontFamily: 'Inter_900Black', // Heaviest weight
    letterSpacing: -1,
  },
  searchPill: {
    width: '100%', // Full width
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF', // White by default for Elite based on target screenshot (white pill on black bg)
    height: 48,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    gap: 12,
  },
  santaSearchPill: {
    backgroundColor: '#FFF',
  },
  searchPlaceholder: {
    color: '#6B7280', // Gray-500 to match web placeholder
    fontSize: 15, // Exact match to web text-[15px]
    fontFamily: 'serif', // System serif to match web's Times font
    lineHeight: 20,
  },
  santaPlaceholder: {
    color: '#666',
  },

  // Minimal Styles
  minimalContainer: {
    backgroundColor: 'transparent',
    paddingBottom: SPACING.sm,
  },
  minimalContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  minimalLogoText: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // Default Styles
  defaultContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  defaultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  defaultLogoText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000',
  },
  defaultSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  defaultSearchPlaceholder: {
    color: '#999',
    fontSize: 14,
  },

  // Common
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: BRAND.primary,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
});