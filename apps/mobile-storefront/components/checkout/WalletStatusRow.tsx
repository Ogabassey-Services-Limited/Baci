import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { RADIUS, SPACING } from '@/constants/Colors';

interface WalletStatusRowProps {
  colors: typeof Colors.light;
  isLoading: boolean;
}

export function WalletStatusRow({ colors, isLoading }: WalletStatusRowProps) {
  return (
    <Pressable
      disabled
      style={[
        styles.methodCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: 0.65,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={
        isLoading
          ? 'Wallet. Checking wallet balance'
          : 'Wallet unavailable. Use card while wallet refreshes'
      }
    >
      <View
        style={[
          styles.methodIconContainer,
          { backgroundColor: `${colors.textSecondary}10` },
        ]}
      >
        <Ionicons
          name="wallet-outline"
          size={24}
          color={colors.textSecondary}
        />
      </View>
      <View style={styles.methodInfo}>
        <Text style={[styles.methodLabel, { color: colors.text }]}>
          {isLoading ? 'Wallet' : 'Wallet unavailable'}
        </Text>
        <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
          {isLoading
            ? 'Checking wallet balance'
            : 'Use card while wallet refreshes'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  methodCard: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    flexDirection: 'row',
    padding: SPACING.md,
  },
  methodDesc: {
    fontSize: 13,
  },
  methodIconContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  methodInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  methodLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});
