/**
 * ScreenSkeleton — shimmer loading placeholder for screens
 * Replaces full-screen ActivityIndicator with content-aware skeletons.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type SkeletonVariant = 'settings' | 'list' | 'card-list';

interface ScreenSkeletonProps {
  /** Layout variant matching the target screen */
  variant?: SkeletonVariant;
  /** Number of skeleton cards to render */
  cards?: number;
  /** Whether the shimmer animation should run */
  animated?: boolean;
}

function createSkeletonKeys(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

function ShimmerBlock({
  height,
  width,
  borderRadius = RADIUS.md,
  animated = true,
}: {
  height: number;
  width?: number | `${number}%`;
  borderRadius?: number;
  animated?: boolean;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (!animated || reducedMotion) {
      cancelAnimation(opacity);
      opacity.value = 0.5; // Static visible state
      return;
    }

    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);

    return () => {
      cancelAnimation(opacity);
    };
  }, [animated, opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      testID="skeleton-block"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height,
          width: width ?? '100%',
          borderRadius,
          backgroundColor: colors.cardHover,
        },
        animatedStyle,
      ]}
    />
  );
}

function SettingsSkeleton({
  cards,
  animated,
}: {
  cards: number;
  animated: boolean;
}) {
  const skeletonKeys = createSkeletonKeys('settings', cards);

  return (
    <View testID="screen-skeleton-settings" style={styles.container}>
      {skeletonKeys.map((key) => (
        <View key={key} testID="settings-card" style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <ShimmerBlock
              height={20}
              width={20}
              borderRadius={RADIUS.full}
              animated={animated}
            />
            <View style={styles.settingsText}>
              <ShimmerBlock height={14} width="60%" animated={animated} />
              <ShimmerBlock height={10} width="40%" animated={animated} />
            </View>
            <ShimmerBlock
              height={24}
              width={44}
              borderRadius={RADIUS.full}
              animated={animated}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function ListSkeleton({
  cards,
  animated,
}: {
  cards: number;
  animated: boolean;
}) {
  const skeletonKeys = createSkeletonKeys('list', cards);

  return (
    <View testID="screen-skeleton-list" style={styles.container}>
      <ShimmerBlock height={80} borderRadius={RADIUS.lg} animated={animated} />
      <View style={styles.spacerLg} />
      {skeletonKeys.map((key) => (
        <View key={key} testID="list-card" style={styles.listCard}>
          <View style={styles.listRow}>
            <View style={styles.listText}>
              <ShimmerBlock height={14} width="50%" animated={animated} />
              <ShimmerBlock height={10} width="30%" animated={animated} />
            </View>
            <ShimmerBlock height={16} width={60} animated={animated} />
          </View>
        </View>
      ))}
    </View>
  );
}

function CardListSkeleton({
  cards,
  animated,
}: {
  cards: number;
  animated: boolean;
}) {
  const skeletonKeys = createSkeletonKeys('card-list', cards);

  return (
    <View testID="screen-skeleton-card-list" style={styles.container}>
      {skeletonKeys.map((key) => (
        <View key={key} testID="card-list-card" style={styles.cardListCard}>
          <ShimmerBlock height={16} width="40%" animated={animated} />
          <View style={styles.spacerSm} />
          <ShimmerBlock height={12} width="70%" animated={animated} />
          <View style={styles.spacerMd} />
          <ShimmerBlock height={36} animated={animated} />
        </View>
      ))}
    </View>
  );
}

export function ScreenSkeleton({
  variant = 'settings',
  cards = 4,
  animated = true,
}: ScreenSkeletonProps) {
  switch (variant) {
    case 'list':
      return <ListSkeleton cards={cards} animated={animated} />;
    case 'card-list':
      return <CardListSkeleton cards={cards} animated={animated} />;
    default:
      return <SettingsSkeleton cards={cards} animated={animated} />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  settingsCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  settingsText: {
    flex: 1,
    gap: SPACING.xs,
  },
  spacerSm: {
    height: SPACING.sm,
  },
  spacerMd: {
    height: SPACING.md,
  },
  spacerLg: {
    height: SPACING.lg,
  },
  listCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listText: {
    flex: 1,
    gap: SPACING.xs,
  },
  cardListCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
});
