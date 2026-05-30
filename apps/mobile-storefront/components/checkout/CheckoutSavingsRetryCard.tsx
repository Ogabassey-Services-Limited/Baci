import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { withAlpha } from '@/constants/Colors';

type CheckoutColors = (typeof Colors)['light'];

type CheckoutSavingsRetryCardProps = {
  colors: CheckoutColors;
  isDark: boolean;
  message: string;
  onRetry: () => void;
};

type CheckoutSavingsRetryColors = {
  badgeBackground: string;
  border: string;
  cardBackground: string;
  icon: string;
  iconBackground: string;
  subtitle: string;
  title: string;
};

function getCheckoutSavingsRetryColors({
  colors,
  isDark,
}: {
  colors: CheckoutColors;
  isDark: boolean;
}): CheckoutSavingsRetryColors {
  const warningSurface = withAlpha(colors.warning, isDark ? 0.16 : 0.1);
  const warningBadge = withAlpha(colors.warning, isDark ? 0.18 : 0.14);

  return {
    badgeBackground: isDark ? colors.muted : warningBadge,
    border: withAlpha(colors.warning, isDark ? 0.7 : 0.45),
    cardBackground: isDark ? colors.muted : warningSurface,
    icon: colors.warning,
    iconBackground: isDark ? colors.card : warningBadge,
    subtitle: isDark ? colors.textSecondary : colors.warning,
    title: colors.text,
  };
}

export function CheckoutSavingsRetryCard({
  colors,
  isDark,
  message,
  onRetry,
}: CheckoutSavingsRetryCardProps) {
  const retryColors = getCheckoutSavingsRetryColors({ colors, isDark });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: retryColors.cardBackground,
          borderColor: retryColors.border,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: retryColors.iconBackground },
        ]}
      >
        <Ionicons name="refresh-outline" size={22} color={retryColors.icon} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: retryColors.title }]}>
          Savings unavailable
        </Text>
        <Text style={[styles.subtitle, { color: retryColors.subtitle }]}>
          {message}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry checkout savings"
        style={[styles.badge, { backgroundColor: retryColors.badgeBackground }]}
        onPress={onRetry}
      >
        <Text style={[styles.badgeText, { color: retryColors.subtitle }]}>
          Retry
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
