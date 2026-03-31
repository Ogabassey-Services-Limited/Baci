/**
 * StatCard Component
 * Displays a key metric with label and optional trend indicator
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
  };
  size?: 'small' | 'large';
}

export function StatCard({
  label,
  value,
  icon,
  iconColor,
  trend,
  size = 'small',
}: StatCardProps) {
  const { colors, shadows } = useTheme();
  const isLarge = size === 'large';
  const finalIconColor = iconColor || colors.primary;

  const trendAccessibilityText = trend
    ? trend.direction === 'up'
      ? `Up by ${trend.value}`
      : trend.direction === 'down'
        ? `Down by ${trend.value}`
        : `No change at ${trend.value}`
    : '';

  const accessibilityLabel =
    `${label}, ${value}. ${trendAccessibilityText}`.trim();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card },
        shadows.sm,
        isLarge && styles.containerLarge,
      ]}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <View
        style={styles.header}
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        {icon ? (
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${finalIconColor}20` },
            ]}
          >
            <Ionicons name={icon} size={16} color={finalIconColor} />
          </View>
        ) : null}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </View>

      <Text
        style={[
          styles.value,
          { color: colors.text },
          isLarge && styles.valueLarge,
        ]}
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
      >
        {value}
      </Text>

      {trend ? (
        <View
          style={styles.trendContainer}
          accessibilityElementsHidden={true}
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons
            name={
              trend.direction === 'up'
                ? 'trending-up'
                : trend.direction === 'down'
                  ? 'trending-down'
                  : 'remove'
            }
            size={14}
            color={
              trend.direction === 'up'
                ? colors.success
                : trend.direction === 'down'
                  ? colors.error
                  : colors.textMuted
            }
          />
          <Text
            style={[
              styles.trendText,
              {
                color:
                  trend.direction === 'up'
                    ? colors.success
                    : trend.direction === 'down'
                      ? colors.error
                      : colors.textMuted,
              },
            ]}
          >
            {trend.value}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    minWidth: 80,
    flex: 1,
    alignItems: 'center',
  },
  containerLarge: {
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textTransform: 'capitalize',
  },
  value: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    textAlign: 'center',
  },
  valueLarge: {
    fontSize: TYPOGRAPHY.size['3xl'],
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  trendText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
