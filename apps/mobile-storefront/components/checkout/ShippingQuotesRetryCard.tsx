import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';

type ColorsScheme = (typeof Colors)['light'];

interface ShippingQuotesRetryCardProps {
  colors: ColorsScheme;
  isDark: boolean;
  onRetryQuotes: () => void;
}

export function ShippingQuotesRetryCard({
  colors,
  isDark,
  onRetryQuotes,
}: ShippingQuotesRetryCardProps) {
  return (
    <Pressable
      onPress={onRetryQuotes}
      style={[
        styles.retryCard,
        {
          borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : '#FCD34D',
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB',
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Reload delivery rates"
    >
      <View
        style={[
          styles.retryIconWrap,
          {
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FEF3C7',
          },
        ]}
      >
        <Ionicons
          name="car-outline"
          size={22}
          color={isDark ? colors.warning : '#B45309'}
        />
      </View>
      <View style={styles.retryTextWrap}>
        <Text
          style={[styles.retryTitle, { color: isDark ? colors.text : '#111827' }]}
        >
          Oops! Rates took a detour
        </Text>
        <Text
          style={[
            styles.retrySubtitle,
            { color: isDark ? colors.textSecondary : '#B45309' },
          ]}
        >
          Our delivery partners are a bit slow today. Tap here to try again.
        </Text>
      </View>
      <View
        style={[
          styles.retryBadge,
          {
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FEF3C7',
          },
        ]}
      >
        <Text
          style={[
            styles.retryBadgeText,
            { color: isDark ? colors.warning : '#B45309' },
          ]}
        >
          Refresh Rates
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  retryCard: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  retryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryTextWrap: {
    alignItems: 'center',
  },
  retryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  retrySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  retryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  retryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
