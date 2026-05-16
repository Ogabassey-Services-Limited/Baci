import { Ionicons } from '@expo/vector-icons';
// router removed as it was unused.
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { type Category, useCategories } from '@/hooks';
import { usePrefetchBillers } from '@/hooks/use-vtu-billers';

interface UtilityPanelProps {
  variant?: 'card' | 'circle' | 'pill';
  selectedCategoryId: string | null;
  onCategorySelect: (id: string | null) => void;
  selectedCategoryName?: string;
  slug?: string;
}

// Module-level constants (stable references, no re-creation per render)
const UTILITY_WORDS = ['Airtime!', 'Data!', 'Tv!', 'Power!', 'Gaming!'];
const CATEGORY_IDS = ['u-airtime', 'u-data', 'u-tv', 'u-power', 'u-gaming'];

interface CategoryItemProps {
  id: string;
  name: string;
  slug?: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  variant: 'card' | 'circle' | 'pill';
  isActive: boolean;
  onPress: () => void;
}

// React Compiler handles memoization (ADR-004)
function CategoryItem({
  id,
  name,
  iconName,
  variant,
  isActive,
  onPress,
}: CategoryItemProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const iconScale = useRef(new Animated.Value(isActive ? 1.05 : 1)).current;
  const labelOpacity = useRef(new Animated.Value(isActive ? 1 : 0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(iconScale, {
        toValue: isActive ? 1.05 : 1,
        damping: 16,
        stiffness: 180,
        mass: 1,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: isActive ? 1 : 0.8,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isActive, iconScale, labelOpacity]);

  if (variant === 'circle') {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[styles.circleItem]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={name}
        accessibilityHint={`Tap to select ${name} services`}
      >
        <Animated.View
          testID={`utility-category-icon-${id}`}
          style={[
            styles.circleIcon,
            { backgroundColor: colors.muted },
            isActive && [
              styles.circleIconActive,
              { backgroundColor: colors.selectedIconBackground },
            ],
            isActive && [styles.activeShadow, { shadowColor: colors.black }],
            { transform: [{ scale: iconScale }] },
          ]}
        >
          <Ionicons
            name={iconName}
            size={20} // Web parity: w-12 container -> ~20px icon
            color={isActive ? BRAND.primary : colors.icon}
          />
        </Animated.View>
        <Animated.Text
          style={[
            styles.circleLabel,
            { color: colors.textSecondary },
            isActive && [styles.circleLabelActive, { color: colors.text }],
            { opacity: labelOpacity },
          ]}
        >
          {name}
        </Animated.Text>
      </TouchableOpacity>
    );
  }

  // Fallback for non-circle variants (keep basic logic)
  return null;
}

export function UtilityPanel({
  variant = 'circle',
  selectedCategoryId,
  onCategorySelect,
  slug,
}: UtilityPanelProps) {
  const {
    data: remoteCategories = [],
    isLoading,
    error,
  } = useCategories();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Prefetch all bill categories so data is ready when user taps a category
  usePrefetchBillers();

  // Web-Parity Auto-Rotation Logic (constants at module level for stable references)

  const [activeUtilityIndex, setActiveUtilityIndex] = useState(0);
  const [isManualUtility, setIsManualUtility] = useState(false);
  const promoWordProgress = useRef(new Animated.Value(1)).current;
  const promoWordTranslateY = promoWordProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 0],
  });

  // Sync prop change to local index (if external change happens)
  useEffect(() => {
    if (selectedCategoryId) {
      const idx = CATEGORY_IDS.indexOf(selectedCategoryId);
      if (idx !== -1) {
        setActiveUtilityIndex(idx);
        // 2026 Best Practice: Do NOT mark as manual here!
        // The parent might have a default selection (e.g. 'Airtime' as first in list),
        // but that shouldn't stop the "attract loop" rotation.
        // Rotation should only stop on explicit USER INTERACTION (handlePress).
      }
    }
  }, [selectedCategoryId]);

  // Auto-rotate effect
  useEffect(() => {
    // 2026 Best Practice: Auto-rotation should run if NOT manual AND
    // the parent selection is either null or the current auto index item
    if (isManualUtility) return;

    const interval = setInterval(() => {
      setActiveUtilityIndex((prev) => (prev + 1) % UTILITY_WORDS.length);
    }, 2800); // Slightly slower for better readability

    return () => clearInterval(interval);
  }, [isManualUtility]);

  useEffect(() => {
    promoWordProgress.setValue(0);
    Animated.timing(promoWordProgress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeUtilityIndex, promoWordProgress]);

  const handlePress = (id: string, index: number) => {
    setIsManualUtility(true);
    // Optimistically set active index for instant feedback
    setActiveUtilityIndex(index);
    onCategorySelect(id);
  };

  const categories = (() => {
    // 2026 Best Practice: Default to utilities if slug matches or is unspecified (safe fallback for this specialized component)
    if (!slug || slug === 'utility' || slug === 'utilities') {
      return [
        {
          id: 'u-airtime',
          name: 'Airtime',
          slug: 'airtime',
          icon: 'call-outline',
        },
        { id: 'u-data', name: 'Data', slug: 'data', icon: 'wifi' },
        { id: 'u-tv', name: 'Tv', slug: 'tv', icon: 'tv-outline' },
        { id: 'u-power', name: 'Power', slug: 'power', icon: 'flash-outline' },
        {
          id: 'u-gaming',
          name: 'Gaming',
          slug: 'gaming',
          icon: 'game-controller-outline',
        },
      ];
    }
    return (remoteCategories || []) as Category[];
  })();

  if (isLoading && categories.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={BRAND.primary} />
      </View>
    );
  }

  // 2026 Best Practice: "Elite" aesthetic requires specific handling for the Utility Panel
  // We want the 'Card' container look (white bg, border) BUT 'Circle' item variant (icons)
  // regardless of what the global template says (which might be 'card' implying square items).
  const isUtility = !slug || slug === 'utility' || slug === 'utilities';
  const hasCategoryError = Boolean(error) && !isUtility;
  const showContainer = variant === 'card' || isUtility;
  const itemVariant = isUtility ? 'circle' : variant; // Force circle icons for utilities

  if (hasCategoryError) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Unable to load categories
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          Please try again in a moment.
        </Text>
      </View>
    );
  }

  return (
    <View style={showContainer ? [styles.container, { backgroundColor: colors.card, borderColor: colors.border }] : styles.minimalContainer}>
      {/* Dynamic Unified Banner */}
      <View
        testID="utility-panel-promo-banner"
        style={[styles.promoBanner, { backgroundColor: colors.promoBackground }]}
      >
        <View style={{ height: 16, justifyContent: 'center' }}>
          <Text style={[styles.promoText, { color: colors.textSecondary }]}>
            We Pay <Text style={styles.promoHighlight}>YOU</Text> When You Buy{' '}
            <Animated.Text
              style={[
                styles.promoHighlight,
                {
                  opacity: promoWordProgress,
                  transform: [{ translateY: promoWordTranslateY }],
                },
              ]}
            >
              {UTILITY_WORDS[activeUtilityIndex] || 'Airtime!'}
            </Animated.Text>
          </Text>
        </View>
      </View>
      <View style={styles.categoriesContent}>
        {categories.map((category, index) => (
          <CategoryItem
            key={category.id}
            id={category.id}
            name={category.name}
            slug={category.slug}
            iconName={
              category.icon as React.ComponentProps<typeof Ionicons>['name']
            }
            variant={itemVariant}
            // Active if: (Manual Interaction & matches selection) OR (Auto Mode & index matches)
            isActive={
              isManualUtility && selectedCategoryId
                ? category.id === selectedCategoryId
                : activeUtilityIndex === index
            }
            onPress={() => handlePress(category.id, index)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: 24, // Web: rounded-3xl
    paddingVertical: SPACING.sm,
    borderWidth: 1,
  },
  minimalContainer: { paddingVertical: SPACING.sm },
  promoBanner: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: 10, // Web: py-3 (approx 10-12px)
    borderRadius: 16, // Web: rounded-2xl
  },
  promoText: { fontSize: 11, textAlign: 'center' },
  promoHighlight: { color: BRAND.primary, fontWeight: '700' },
  categoriesContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8, // Web: px-1 (approx 4-8px)
    width: '100%',
  },
  circleItem: { alignItems: 'center', flex: 1 },
  circleIcon: {
    width: 48, // Web: w-12
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  circleIconActive: {
    borderColor: BRAND.primary,
    borderWidth: 1,
  },
  activeShadow: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  circleLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  circleLabelActive: {
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
  // Keep pill styles just in case valid/used elsewhere, though variant is mostly circle here
  pillItem: {},
  pillLabel: {},
  categoryItem: {},
  categoryActive: {},
  iconContainer: {},
  iconContainerActive: {},
  categoryLabel: {},
  categoryLabelActive: {},
});
