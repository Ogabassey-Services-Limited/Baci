import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WalletStatusRow } from '@/components/checkout/WalletStatusRow';
import type Colors from '@/constants/Colors';
import { BRAND, RADIUS, SPACING } from '@/constants/Colors';
import type { WalletSelection } from '@/lib/wallet-payment-helpers';
import { formatPrice } from '@/stores/cart-store';
import type { WalletPaymentState } from './wallet-payment-state';

const CHECKBOX_INNER_RADIUS = 2;
const CHECKBOX_OUTER_RADIUS = 4;
const RADIO_INNER_RADIUS = 6;
const RADIO_OUTER_RADIUS = 11;

interface WalletPaymentProps {
  colors: typeof Colors.light;
  onWalletToggle?: (selection: WalletSelection) => void;
  state: WalletPaymentState;
  walletBalance: number;
  walletIsLoading: boolean;
}

export function WalletPayment({
  colors,
  onWalletToggle,
  state,
  walletBalance,
  walletIsLoading,
}: WalletPaymentProps) {
  if (state.statusShouldRender) {
    return <WalletStatusRow colors={colors} isLoading={walletIsLoading} />;
  }

  if (state.infoShouldRender) {
    return (
      <View
        style={[
          styles.methodCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        accessibilityRole="text"
        accessibilityLabel={`Wallet balance applies automatically. ${formatPrice(state.portion)} available now`}
      >
        <View
          style={[
            styles.methodIconContainer,
            { backgroundColor: `${BRAND.primary}20` },
          ]}
        >
          <Ionicons name="wallet-outline" size={24} color={BRAND.primary} />
        </View>

        <View style={styles.methodInfo}>
          <Text style={[styles.methodLabel, { color: colors.text }]}>
            Wallet balance applies automatically
          </Text>
          <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
            {`${formatPrice(state.portion)} available now · transfer shortfall only`}
          </Text>
        </View>
      </View>
    );
  }

  if (!state.shouldRender) {
    return null;
  }

  const handleWalletToggle = () => {
    if (!onWalletToggle) {
      return;
    }
    if (state.isActive) {
      onWalletToggle({ use: false, amount: 0 });
    } else {
      onWalletToggle({ use: true, amount: state.portion });
    }
  };

  const walletAccessibilityLabel = state.coversFully
    ? `Pay with wallet, ${formatPrice(walletBalance)} available`
    : `Use wallet credit, ${formatPrice(state.portion)} of ${formatPrice(state.effectiveTotal)}`;

  return (
    <Pressable
      onPress={handleWalletToggle}
      style={[
        styles.methodCard,
        {
          backgroundColor: colors.card,
          borderColor: state.isActive ? BRAND.primary : colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{
        checked: state.isActive,
        disabled: !onWalletToggle,
      }}
      accessibilityLabel={walletAccessibilityLabel}
      disabled={!onWalletToggle}
    >
      <View
        style={[
          styles.methodIconContainer,
          {
            backgroundColor: state.isActive
              ? `${BRAND.primary}20`
              : `${colors.textSecondary}10`,
          },
        ]}
      >
        <Ionicons
          name="wallet-outline"
          size={24}
          color={state.isActive ? BRAND.primary : colors.textSecondary}
        />
      </View>

      <View style={styles.methodInfo}>
        <Text
          style={[
            styles.methodLabel,
            { color: state.isActive ? BRAND.primary : colors.text },
          ]}
        >
          {state.coversFully ? 'Pay with wallet' : 'Use wallet credit'}
        </Text>
        <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
          {state.coversFully
            ? `${formatPrice(walletBalance)} available · covers full order`
            : `${formatPrice(state.portion)} from wallet · ${formatPrice(state.residualToGateway)} from card`}
        </Text>
      </View>

      <View
        style={[
          styles.radioOuter,
          {
            borderColor: state.isActive ? BRAND.primary : colors.border,
            borderRadius: state.coversFully
              ? RADIO_OUTER_RADIUS
              : CHECKBOX_OUTER_RADIUS,
          },
        ]}
      >
        {state.isActive && (
          <View
            style={[
              styles.radioInner,
              {
                backgroundColor: BRAND.primary,
                borderRadius: state.coversFully
                  ? RADIO_INNER_RADIUS
                  : CHECKBOX_INNER_RADIUS,
              },
            ]}
          />
        )}
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
  radioInner: {
    borderRadius: RADIO_INNER_RADIUS,
    height: 12,
    width: 12,
  },
  radioOuter: {
    alignItems: 'center',
    borderRadius: RADIO_OUTER_RADIUS,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
});
