/**
 * Header Component - Multi-Tenant Template System
 * Supports 'elite', 'standard', and 'minimal' styles
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { type Href, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/ui/Logo';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';
import { CONFIG } from '@/lib/config';
import { SEASONAL } from '@/lib/seasonal';
import { getTemplateConfig } from '@/lib/templates';
import { useCartStore } from '@/stores/cart-store';
import { useDrawerStore } from '@/stores/drawer-store';
import { useThemeStore } from '@/stores/theme-store';
import { getEliteHeaderTopPadding } from './header-layout';

interface HeaderProps {
  showSearch?: boolean;
  onSearchPress?: () => void;
  isSearchActive?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (text: string) => void;
  onSearchSubmit?: () => void;
  onSearchCancel?: () => void;
}

// Background pattern from web (SVG Data URI)

export function Header({
  showSearch = true,
  onSearchPress,
  isSearchActive = false,
  searchQuery = '',
  onSearchQueryChange,
  onSearchSubmit,
  onSearchCancel,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef<TextInput>(null);
  const itemCount = useCartStore((state) => state.itemCount());
  const openDrawer = useDrawerStore((state) => state.openDrawer);
  const template = getTemplateConfig(CONFIG.BUSINESS_TYPE, CONFIG.TEMPLATE_ID);
  const theme = useThemeStore((state) => state.theme);
  const { colors } = useTheme();

  const styles = getStyles(colors);

  // Focus the search input when search mode activates (ref-based to avoid autoFocus a11y warning)
  useEffect(() => {
    if (isSearchActive) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isSearchActive]);

  const handleSearchPress = () => {
    if (onSearchPress) {
      onSearchPress();
    } else {
      router.push('/search');
    }
  };

  const storeName = Constants.expoConfig?.name || 'Baci Store';
  const isSanta = SEASONAL.shouldShowSanta(theme);
  const seasonalTokens = SEASONAL.getTokens(theme);

  // --- RENDER: Elite Merged Layout (Electronics/High-Tech) ---
  if (template.headerStyle === 'elite' || isSanta) {
    const eliteTopPadding = getEliteHeaderTopPadding(insets.top);

    return (
      <View
        style={[
          styles.eliteContainer,
          { paddingTop: eliteTopPadding },
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
          {/* Row 1: Nav, Logo, Actions - Always visible to prevent layout shift */}
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
                onPress={() => router.push('/')}
                style={styles.logoContainer}
                accessibilityLabel={`${storeName}, go to home`}
                accessibilityRole="button"
              >
                <Logo width={140} height={25} color="white" />
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              {/* <Pressable onPress={() => router.push('/notifications' as any)} hitSlop={12} style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={24} color={colors.text} />
            </Pressable> */}
              {/* Note: Web view doesn't show bell in header usually, simplifying to match web if needed, 
                but keeping specific user request "utility bar" separate. 
                Let's keep Cart prominent as per standard e-commerce. */}
              <Pressable
                onPress={() => router.push('/cart')}
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
                  <View style={styles.badge} accessibilityElementsHidden={true}>
                    <Text style={styles.badgeText}>{itemCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Row 2: Search Bar */}
          {showSearch && (
            <View
              style={[
                styles.searchRow,
                isSearchActive && styles.searchRowActive,
              ]}
            >
              <View
                style={[
                  styles.searchPill,
                  isSanta && styles.santaSearchPill,
                  isSearchActive && styles.activeSearchPill,
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={
                    isSearchActive ? colors.textSecondary : colors.placeholder
                  }
                />
                {!isSearchActive ? (
                  <Pressable
                    onPress={handleSearchPress}
                    style={styles.searchPillPressable}
                    hitSlop={12}
                    accessibilityLabel="Search products, brands and categories"
                    accessibilityRole="search"
                  >
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
                ) : (
                  <TextInput
                    ref={searchInputRef}
                    style={[styles.searchInput, { color: colors.text }]}
                    value={searchQuery}
                    onChangeText={onSearchQueryChange}
                    onSubmitEditing={onSearchSubmit}
                    placeholder="Search products..."
                    placeholderTextColor={colors.placeholder}
                    returnKeyType="search"
                    selectTextOnFocus={true}
                    clearButtonMode="while-editing"
                  />
                )}
              </View>

              {isSearchActive && (
                <Pressable
                  onPress={onSearchCancel}
                  hitSlop={10}
                  accessibilityLabel="Cancel search"
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              )}
            </View>
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
                onPress={handleSearchPress}
                hitSlop={12}
                style={styles.iconBtn}
                accessibilityLabel="Search products"
                accessibilityRole="button"
              >
                <Ionicons name="search-outline" size={24} color={colors.text} />
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push('/cart')}
              hitSlop={12}
              style={styles.iconBtn}
              accessibilityLabel={
                itemCount > 0
                  ? `Shopping cart, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}`
                  : 'Shopping cart, empty'
              }
              accessibilityRole="button"
            >
              <Ionicons name="bag-outline" size={24} color={colors.text} />
              {itemCount > 0 && (
                <View
                  style={[styles.badge, { backgroundColor: colors.text }]}
                  accessibilityElementsHidden={true}
                >
                  <Text
                    style={[styles.badgeText, { color: colors.background }]}
                  >
                    {itemCount}
                  </Text>
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
            onPress={() => router.push('/cart')}
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
              <View style={styles.badge} accessibilityElementsHidden={true}>
                <Text style={styles.badgeText}>{itemCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      {showSearch && (
        <Pressable
          style={styles.defaultSearchBar}
          onPress={handleSearchPress}
          accessibilityLabel="Search our collection"
          accessibilityRole="search"
        >
          <Ionicons name="search" size={18} color={colors.placeholder} />
          <Text style={styles.defaultSearchPlaceholder}>
            Search our collection...
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// Extract ThemeColors type from useTheme return
type ThemeColors = ReturnType<typeof useTheme>['colors'];

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // Elite Styles
    eliteContainer: {
      backgroundColor: 'transparent', // Transparent to allow Hero to sit ON TOP of index.tsx background
      paddingBottom: SPACING.md,
      borderBottomWidth: 0,
      zIndex: 10,
    },
    santaText: {
      color: colors.foreground,
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
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      width: '100%',
    },
    searchRowActive: {
      paddingVertical: 2,
    },
    searchPill: {
      flex: 1, // Allow row to handle button
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      height: 48,
      borderRadius: RADIUS.md,
      paddingHorizontal: 16,
      gap: 12,
    },
    activeSearchPill: {
      borderWidth: 1.5,
      borderColor: BRAND.primary,
    },
    searchPillPressable: {
      flex: 1,
      height: '100%',
      justifyContent: 'center',
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      fontFamily: 'serif',
      height: '100%',
      padding: 0,
    },
    santaSearchPill: {
      backgroundColor: colors.card,
    },
    searchPlaceholder: {
      color: colors.textSecondary,
      fontSize: 15, // Exact match to web text-[15px]
      fontFamily: 'serif', // System serif to match web's Times font
      lineHeight: 20,
    },
    santaPlaceholder: {
      color: colors.textSecondary,
    },
    cancelText: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '600',
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
      color: colors.text,
      textTransform: 'uppercase',
      letterSpacing: 2,
    },

    // Default Styles
    defaultContainer: {
      backgroundColor: colors.background,
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
      color: colors.text,
    },
    defaultSearchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.muted,
      borderRadius: RADIUS.lg,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    defaultSearchPlaceholder: {
      color: colors.placeholder,
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
      backgroundColor: colors.background,
      width: '100%',
    },
  });
