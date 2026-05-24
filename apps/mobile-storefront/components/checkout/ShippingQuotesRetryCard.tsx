import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { RADIUS, SPACING } from '@/constants/Colors';

const AMBER_300 = '#FCD34D';
const AMBER_100 = '#FEF3C7';
const AMBER_700 = '#B45309';

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
          borderColor: isDark ? 'rgba(245, 158, 11, 0.4)' : AMBER_300,
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
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : AMBER_100,
          },
        ]}
      >
        <Ionicons
          name="car-outline"
          size={22}
          color={isDark ? colors.warning : AMBER_700}
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
            { color: isDark ? colors.textSecondary : AMBER_700 },
          ]}
        >
          Our delivery partners are a bit slow today. Tap here to try again.
        </Text>
      </View>
      <View
        style={[
          styles.retryBadge,
          {
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : AMBER_100,
          },
        ]}
      >
        <Text
          style={[
            styles.retryBadgeText,
            { color: isDark ? colors.warning : AMBER_700 },
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
    borderRadius: RADIUS['2xl'],
    padding: SPACING.md,
    alignItems: 'center',
    gap: 10,
  },
  retryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
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
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  retryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  retryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
