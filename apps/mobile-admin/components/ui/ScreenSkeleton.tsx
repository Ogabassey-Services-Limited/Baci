/**
 * ScreenSkeleton — shimmer loading placeholder for screens
 * Replaces full-screen ActivityIndicator with content-aware skeletons.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
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
}

function createSkeletonKeys(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index}`);
}

function ShimmerBlock({
  height,
  width,
  borderRadius = RADIUS.md,
}: {
  height: number;
  width?: number | `${number}%`;
  borderRadius?: number;
}) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height,
          width: width ?? '100%',
          borderRadius,
          backgroundColor: colors.border,
        },
        animatedStyle,
      ]}
    />
  );
}

function SettingsSkeleton({ cards }: { cards: number }) {
  const skeletonKeys = createSkeletonKeys('settings', cards);

  return (
    <View style={styles.container}>
      {skeletonKeys.map((key) => (
        <View key={key} style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <ShimmerBlock height={20} width={20} borderRadius={RADIUS.full} />
            <View style={styles.settingsText}>
              <ShimmerBlock height={14} width="60%" />
              <ShimmerBlock height={10} width="40%" />
            </View>
            <ShimmerBlock height={24} width={44} borderRadius={RADIUS.full} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ListSkeleton({ cards }: { cards: number }) {
  const skeletonKeys = createSkeletonKeys('list', cards);

  return (
    <View style={styles.container}>
      <ShimmerBlock height={80} borderRadius={RADIUS.lg} />
      <View style={styles.spacerLg} />
      {skeletonKeys.map((key) => (
        <View key={key} style={styles.listCard}>
          <View style={styles.listRow}>
            <View style={styles.listText}>
              <ShimmerBlock height={14} width="50%" />
              <ShimmerBlock height={10} width="30%" />
            </View>
            <ShimmerBlock height={16} width={60} />
          </View>
        </View>
      ))}
    </View>
  );
}

function CardListSkeleton({ cards }: { cards: number }) {
  const skeletonKeys = createSkeletonKeys('card-list', cards);

  return (
    <View style={styles.container}>
      {skeletonKeys.map((key) => (
        <View key={key} style={styles.cardListCard}>
          <ShimmerBlock height={16} width="40%" />
          <View style={styles.spacerSm} />
          <ShimmerBlock height={12} width="70%" />
          <View style={styles.spacerMd} />
          <ShimmerBlock height={36} />
        </View>
      ))}
    </View>
  );
}

export function ScreenSkeleton({
  variant = 'settings',
  cards = 4,
}: ScreenSkeletonProps) {
  switch (variant) {
    case 'list':
      return <ListSkeleton cards={cards} />;
    case 'card-list':
      return <CardListSkeleton cards={cards} />;
    default:
      return <SettingsSkeleton cards={cards} />;
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
