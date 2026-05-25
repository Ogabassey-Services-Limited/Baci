import { StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { SPACING } from '@/constants/Colors';

const PAYSTACK_BLUE_DARK_MODE = '#5CD6FF';
const PAYSTACK_BLUE = '#011B33';

interface UtilityPaystackTrustBadgeProps {
  colors: typeof Colors.light;
  isDark: boolean;
}

export function UtilityPaystackTrustBadge({
  colors,
  isDark,
}: UtilityPaystackTrustBadgeProps) {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.trustText, { color: colors.textSecondary }]}>
        Secured by
      </Text>
      <Text
        style={[
          styles.wordmark,
          { color: isDark ? PAYSTACK_BLUE_DARK_MODE : PAYSTACK_BLUE },
        ]}
      >
        Paystack
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trustText: {
    fontSize: 11,
    fontWeight: '600',
  },
  wordmark: {
    fontSize: 13,
    fontWeight: '800',
  },
});
