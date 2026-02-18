import { Ionicons } from '@expo/vector-icons';
// router removed as it was unused.
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BRAND, SPACING } from '@/constants/Colors';
import { type Category, useCategories } from '@/hooks/use-products';

interface UtilityPanelProps {
  variant?: 'card' | 'circle' | 'pill';
  selectedCategoryId: string | null;
  onCategorySelect: (id: string | null) => void;
  selectedCategoryName?: string;
  slug?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(TouchableOpacity);
// Animated Icon wrapper for color interpolation
const AnimatedIcon = Animated.createAnimatedComponent(Ionicons);

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
  name,
  iconName,
  variant,
  isActive,
  onPress,
}: CategoryItemProps) {
  const progress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, { duration: 300 });
  }, [isActive, progress]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1],
        ['#F3F4F6', '#FEF2F2'] // gray-100 to red-50 (tint)
      ),
      borderColor: interpolateColor(
        progress.value,
        [0, 1],
        ['transparent', BRAND.primary]
      ),
      borderWidth: 1, // Ensure border exists for transition
    };
  });

  const animatedIconProps = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        progress.value,
        [0, 1],
        ['#4B5563', BRAND.primary] // gray-600 to brand primary
      ),
    };
  });

  const animatedLabelStyle = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        progress.value,
        [0, 1],
        ['#4B5563', '#111827'] // gray-600 to gray-900
      ),
    };
  });

  const handlePressIn = () => {};

  const handlePressOut = () => {};

  if (variant === 'circle') {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.circleItem]}
      >
        <Animated.View
          style={[
            styles.circleIcon,
            animatedContainerStyle,
            isActive && styles.activeShadow,
          ]}
        >
          {/* Using Ionicons directly inside Animated.View if color prop animation is tricky, 
              but Reanimated color interpolation on parent View text/icons requires AnimatedComponent.
              Simple approach: Re-render icon color based on isActive for reliability if needed, 
              but let's try basic animated styles or prop. Reanimated supports `color` not on View.
              So we use AnimatedIcon. 
           */}
          <AnimatedIcon
            name={iconName}
            size={20} // Web parity: w-12 container -> ~20px icon
            style={animatedIconProps}
          />
        </Animated.View>
        <Animated.Text
          style={[
            styles.circleLabel,
            animatedLabelStyle,
            isActive && { fontWeight: '700' },
          ]}
        >
          {name}
        </Animated.Text>
      </AnimatedPressable>
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
  const { data: remoteCategories = [], isLoading } = useCategories();

  // Web-Parity Auto-Rotation Logic (constants at module level for stable references)

  const [activeUtilityIndex, setActiveUtilityIndex] = useState(0);
  const [isManualUtility, setIsManualUtility] = useState(false);

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
      <View style={styles.container}>
        <ActivityIndicator size="small" color={BRAND.primary} />
      </View>
    );
  }

  // 2026 Best Practice: "Elite" aesthetic requires specific handling for the Utility Panel
  // We want the 'Card' container look (white bg, border) BUT 'Circle' item variant (icons)
  // regardless of what the global template says (which might be 'card' implying square items).
  const isUtility = !slug || slug === 'utility' || slug === 'utilities';
  const showContainer = variant === 'card' || isUtility;
  const itemVariant = isUtility ? 'circle' : variant; // Force circle icons for utilities

  return (
    <View style={showContainer ? styles.container : styles.minimalContainer}>
      {/* Dynamic Unified Banner */}
      <View style={styles.promoBanner}>
        <View style={{ height: 16, justifyContent: 'center' }}>
          <Text style={styles.promoText}>
            We Pay <Text style={styles.promoHighlight}>YOU</Text> When You Buy{' '}
            <Animated.Text
              key={`utility-${activeUtilityIndex}`}
              entering={FadeIn.duration(400)}
              exiting={FadeOut.duration(400)}
              style={styles.promoHighlight}
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
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: 24, // Web: rounded-3xl
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  minimalContainer: { paddingVertical: SPACING.sm },
  promoBanner: {
    backgroundColor: '#FEF2F2', // bg-red-50
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    paddingVertical: 10, // Web: py-3 (approx 10-12px)
    borderRadius: 16, // Web: rounded-2xl
  },
  promoText: { fontSize: 11, color: '#374151', textAlign: 'center' },
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
    backgroundColor: '#F3F4F6', // Web: bg-gray-100 (inactive)
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  activeShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  circleLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 2,
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
