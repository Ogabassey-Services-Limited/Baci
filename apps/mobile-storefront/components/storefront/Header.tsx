/**
 * Header Component - Multi-Tenant Template System
 * Supports 'elite', 'standard', and 'minimal' styles
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/ui/Logo';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { CONFIG } from '@/lib/config';
import { SEASONAL } from '@/lib/seasonal';
import { getTemplateConfig } from '@/lib/templates';
import { useCartStore } from '@/stores/cart-store';
import { useDrawerStore } from '@/stores/drawer-store';
import { useThemeStore } from '@/stores/theme-store';

interface HeaderProps {
  showSearch?: boolean;
  onSearchPress?: () => void;
}

// Background pattern from web (SVG Data URI)


export function Header({ showSearch = true, onSearchPress }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const itemCount = useCartStore((state) => state.itemCount());
  const openDrawer = useDrawerStore((state) => state.openDrawer);
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
  const isSanta = SEASONAL.shouldShowSanta(theme);
  const seasonalTokens = useMemo(() => SEASONAL.getTokens(theme), [theme]);

  // --- RENDER: Elite Merged Layout (Electronics/High-Tech) ---
  if (template.headerStyle === 'elite' || isSanta) {
    return (
      <View
        style={[
          styles.eliteContainer,
          { paddingTop: insets.top + SPACING.sm },
          isSanta && { backgroundColor: seasonalTokens.holidayBg },
        ]}
      >
        {/* Web Pattern Background - ONLY for the very top row if we want, but letting index.tsx handle foundation */}

        {/* Santa Mode Overlay (if active) */}
        {isSanta && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: 'rgba(255,0,0,0.1)' },
            ]}
          />
        )}

        <View style={styles.eliteContent}>
          {/* Row 1: Nav, Logo, Actions */}
          <View style={styles.topRow}>
            <View style={styles.leftGroup}>
              {/* Navigation drawer trigger */}
              <Pressable
                onPress={openDrawer}
                hitSlop={12}
                style={styles.menuBtn}
                accessibilityLabel="Open navigation menu"
                accessibilityRole="button"
              >
                <Ionicons name="menu-outline" size={28} color="#FFF" />
              </Pressable>

              <Pressable
                onPress={() => router.push('/(tabs)')}
                style={styles.logoContainer}
                accessibilityLabel={`${storeName}, go to home`}
                accessibilityRole="button"
              >
                <Logo width={140} height={25} color="white" />
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              {/* <Pressable onPress={() => router.push('/notifications' as any)} hitSlop={12} style={styles.iconBtn}>
                <Ionicons name="notifications-outline" size={24} color="#FFF" />
              </Pressable> */}
              {/* Note: Web view doesn't show bell in header usually, simplifying to match web if needed, 
                  but keeping specific user request "utility bar" separate. 
                  Let's keep Cart prominent as per standard e-commerce. */}
              <Pressable
                onPress={() => router.push('/(tabs)/cart')}
                hitSlop={12}
                style={styles.iconBtn}
                accessibilityLabel={
                  itemCount > 0
                    ? `Shopping cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
                    : 'Shopping cart, empty'
                }
                accessibilityRole="button"
              >
                <Ionicons name="cart-outline" size={26} color="#FFF" />
                {itemCount > 0 && (
                  <View
                    style={styles.badge}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden={true}
                  >
                    <Text style={styles.badgeText}>{itemCount}</Text>
                  </View>
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
              accessibilityLabel="Search products, brands and categories"
              accessibilityRole="search"
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={isSanta ? '#666' : '#999'}
              />
              <Text
                style={[
                  styles.searchPlaceholder,
                  isSanta && styles.santaPlaceholder,
                ]}
                numberOfLines={1}
              >
                Search products, brands and categories
              </Text>
            </Pressable>
          )}
        </View>

        {/* Removed extensionArea from here to allow Hero to sit on TOP */}
      </View>
    );
  }

  // --- RENDER: Minimal Layout (Fashion/Beauty) ---
  if (template.headerStyle === 'minimal') {
    return (
      <View
        style={[
          styles.minimalContainer,
          { paddingTop: insets.top + SPACING.sm },
        ]}
      >
        <View style={styles.minimalContent}>
          <Text style={styles.minimalLogoText}>
            {storeName.split(' - ')[0]}
          </Text>
          <View style={styles.actionRow}>
            {showSearch && (
              <Pressable
                onPress={handleSearch}
                hitSlop={12}
                style={styles.iconBtn}
                accessibilityLabel="Search products"
                accessibilityRole="button"
              >
                <Ionicons name="search-outline" size={24} color="#000" />
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push('/(tabs)/cart')}
              hitSlop={12}
              style={styles.iconBtn}
              accessibilityLabel={
                itemCount > 0
                  ? `Shopping cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
                  : 'Shopping cart, empty'
              }
              accessibilityRole="button"
            >
              <Ionicons name="bag-outline" size={24} color="#000" />
              {itemCount > 0 && (
                <View
                  style={[styles.badge, { backgroundColor: '#000' }]}
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden={true}
                >
                  <Text style={styles.badgeText}>{itemCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // --- RENDER: Standard Layout (Home Goods/Services) ---
  return (
    <View
      style={[styles.defaultContainer, { paddingTop: insets.top + SPACING.sm }]}
    >
      <View style={styles.defaultTopRow}>
        <Text style={styles.defaultLogoText}>{storeName.split(' - ')[0]}</Text>
        <View style={styles.actionRow}>
          <Pressable
            onPress={() => router.push('/notifications' as Href)}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={BRAND.primary}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(tabs)/cart')}
            hitSlop={12}
            style={styles.iconBtn}
            accessibilityLabel={
              itemCount > 0
                ? `Shopping cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
                : 'Shopping cart, empty'
            }
            accessibilityRole="button"
          >
            <Ionicons name="cart-outline" size={24} color={BRAND.primary} />
            {itemCount > 0 && (
              <View
                style={styles.badge}
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden={true}
              >
                <Text style={styles.badgeText}>{itemCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      {showSearch && (
        <Pressable style={styles.defaultSearchBar} onPress={handleSearch}>
          <Ionicons name="search" size={18} color="#999" />
          <Text style={styles.defaultSearchPlaceholder}>
            Search our collection...
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Elite Styles
  eliteContainer: {
    backgroundColor: 'transparent', // Transparent to allow Hero to sit ON TOP of index.tsx background
    paddingBottom: SPACING.md,
    borderBottomWidth: 0,
    zIndex: 10,
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
    width: 44,
    height: 44,
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
    width: 44,
    height: 44,
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
  extensionArea: {
    height: 80, // Space for Hero overlap
    backgroundColor: '#000',
    width: '100%',
  },
});
