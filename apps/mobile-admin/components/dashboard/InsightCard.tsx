/**
 * InsightCard Component
 * AI-powered insight or tip card with gradient background
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface InsightCardProps {
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  onDismiss?: () => void;
}

export function InsightCard({
  title,
  message,
  icon = 'sparkles',
  onPress,
  onDismiss,
}: InsightCardProps) {
  const { colors, isDark } = useTheme();

  const gradientColors = isDark
    ? (['#1A1A2E', '#252542'] as const)
    : (['#F8FAFC', '#EFF6FF'] as const);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { borderColor: colors.border },
        pressed && onPress && styles.pressed,
      ]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Insight: ${title}`}
      accessibilityState={{ disabled: !onPress }}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: colors.goldLight },
            ]}
          >
            <Ionicons name={icon} size={16} color={colors.gold} />
          </View>
          {onDismiss && (
            <Pressable
              style={[
                styles.dismissButton,
                { backgroundColor: colors.backgroundLight },
              ]}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Dismiss insight"
              accessibilityHint="Removes this insight card from the dashboard"
            >
              <Ionicons name="close" size={14} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>

        {onPress && (
          <View style={styles.actionContainer}>
            <Text style={[styles.actionText, { color: colors.gold }]}>
              Learn more
            </Text>
            <Ionicons name="arrow-forward" size={14} color={colors.gold} />
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  gradient: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: 2,
  },
  message: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.size.xs * TYPOGRAPHY.lineHeight.normal,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.sm,
  },
  actionText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
