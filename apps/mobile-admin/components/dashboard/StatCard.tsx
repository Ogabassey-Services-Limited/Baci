/**
 * StatCard Component
 * Displays a key metric with label and optional trend indicator
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

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

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.card },
        shadows.sm,
        isLarge && styles.containerLarge,
      ]}
    >
      <View style={styles.header}>
        {icon && (
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: finalIconColor + '20' },
            ]}
          >
            <Ionicons name={icon} size={16} color={finalIconColor} />
          </View>
        )}
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
      >
        {value}
      </Text>

      {trend && (
        <View style={styles.trendContainer}>
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
      )}
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
