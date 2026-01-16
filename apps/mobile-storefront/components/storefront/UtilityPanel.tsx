/**
 * Utility Panel Component - Multi-Tenant Template System
 * Supports 'card', 'circle', and 'pill' styles with Reanimated motion
 */

import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BRAND, RADIUS, SPACING, SPRING_CONFIG } from '@/constants/Colors';
import { useCategories } from '@/hooks/use-products-query';
import { getCategoryIcon } from '@/lib/icon-bridge';

interface UtilityPanelProps {
  variant?: 'card' | 'circle' | 'pill';
  selectedCategoryId: string | null;
  onCategorySelect: (id: string | null) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CategoryItem = ({
  id,
  name,
  slug,
  variant,
  isActive,
  onPress,
}: {
  id: string | null;
  name: string;
  slug: string;
  variant: string;
  isActive: boolean;
  onPress: () => void;
}) => {
  const scale = useSharedValue(1);
  const iconName = getCategoryIcon(slug);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, SPRING_CONFIG.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG.snappy);
  };

  if (variant === 'circle') {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.circleItem, animatedStyle]}
      >
        <View
          style={[
            styles.circleIcon,
            isActive && {
              backgroundColor: BRAND.primary,
              borderColor: BRAND.primary,
            },
          ]}
        >
          <Ionicons
            name={iconName}
            size={26}
            color={isActive ? '#FFF' : BRAND.primary}
          />
        </View>
        <Text
          style={[
            styles.circleLabel,
            isActive && { color: BRAND.primary, fontWeight: '700' },
          ]}
        >
          {name}
        </Text>
      </AnimatedPressable>
    );
  }

  if (variant === 'pill') {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.pillItem,
          isActive && {
            backgroundColor: BRAND.primary,
            borderColor: BRAND.primary,
          },
          animatedStyle,
        ]}
      >
        <Text style={[styles.pillLabel, isActive && { color: '#FFF' }]}>
          {name}
        </Text>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.categoryItem,
        isActive && styles.categoryActive,
        animatedStyle,
      ]}
    >
      <View
        style={[styles.iconContainer, isActive && styles.iconContainerActive]}
      >
        <Ionicons
          name={id === null ? 'grid-outline' : iconName}
          size={24}
          color={isActive ? '#FFF' : BRAND.primary}
        />
      </View>
      <Text
        style={[styles.categoryLabel, isActive && styles.categoryLabelActive]}
      >
        {name}
      </Text>
    </AnimatedPressable>
  );
};

export function UtilityPanel({
  variant = 'pill',
  selectedCategoryId,
  onCategorySelect,
}: UtilityPanelProps) {
  const { data: categories = [], isLoading } = useCategories();

  if (isLoading && categories.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={BRAND.primary} />
      </View>
    );
  }

  return (
    <View
      style={variant === 'card' ? styles.container : styles.minimalContainer}
    >
      {variant === 'card' && (
        <View style={styles.promoBanner}>
          <Text style={styles.promoText}>
            Exclusive <Text style={styles.promoHighlight}>DEALS</Text> for you
            today!
          </Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={
          variant === 'pill' ? styles.pillRail : styles.categoriesContent
        }
      >
        <CategoryItem
          id={null}
          name="All"
          slug="general"
          variant={variant}
          isActive={selectedCategoryId === null}
          onPress={() => onCategorySelect(null)}
        />
        {categories.map((category) => (
          <CategoryItem
            key={category.id}
            id={category.id}
            name={category.name}
            slug={category.slug}
            variant={variant}
            isActive={selectedCategoryId === category.id}
            onPress={() => onCategorySelect(category.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS['2xl'],
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  minimalContainer: { paddingVertical: SPACING.md },
  promoBanner: {
    backgroundColor: '#FEF2F2',
    marginHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  promoText: { fontSize: 11, color: '#374151', textAlign: 'center' },
  promoHighlight: { color: BRAND.primary, fontWeight: '700' },
  categoriesContent: { paddingHorizontal: SPACING.md, gap: SPACING.md },

  categoryItem: { alignItems: 'center', minWidth: 80 },
  categoryActive: { opacity: 1 },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainerActive: { backgroundColor: BRAND.primary },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
  },
  categoryLabelActive: { color: BRAND.primary },

  circleItem: { alignItems: 'center', gap: 8, marginRight: 8 },
  circleIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF2F2', // Light Red / Pink
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginTop: 4,
  },

  pillRail: { paddingHorizontal: SPACING.md, gap: 8 },
  pillItem: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#EEE',
    backgroundColor: '#FFF',
  },
  pillLabel: { fontSize: 14, fontWeight: '600', color: '#666' },
});
