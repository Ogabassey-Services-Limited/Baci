import Ionicons from "@react-native-vector-icons/ionicons";
import { Pressable, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { WalletStatusRow } from '@/components/checkout/WalletStatusRow';
import { formatPrice } from '@/stores/cart-store';
import { paymentMethodSelectorStyles as styles } from './styles';

type ThemeColors = (typeof Colors)['light'];

interface PaymentMethodStoreCreditRowsProps {
  colors: ThemeColors;
  onSavingsToggle?: () => void;
  onWalletToggle?: () => void;
  savingsAccessibilityLabel: string;
  savingsCoversFully: boolean;
  savingsGoalDisplayName: string;
  savingsIsActive: boolean;
  savingsPortion: number;
  savingsResidualToGateway: number;
  savingsShouldRender: boolean;
  savingsTotalBalance: number;
  walletAccessibilityLabel: string;
  walletCoversFully: boolean;
  walletInfoShouldRender: boolean;
  walletIsActive: boolean;
  walletPortion: number;
  walletResidualToCard: number;
  walletShouldRender: boolean;
  walletStatusShouldRender: boolean;
  walletTotalBalance: number;
  walletIsLoading: boolean;
}

export function PaymentMethodStoreCreditRows({
  colors,
  onSavingsToggle,
  onWalletToggle,
  savingsAccessibilityLabel,
  savingsCoversFully,
  savingsGoalDisplayName,
  savingsIsActive,
  savingsPortion,
  savingsResidualToGateway,
  savingsShouldRender,
  savingsTotalBalance,
  walletAccessibilityLabel,
  walletCoversFully,
  walletInfoShouldRender,
  walletIsActive,
  walletIsLoading,
  walletPortion,
  walletResidualToCard,
  walletShouldRender,
  walletStatusShouldRender,
  walletTotalBalance,
}: PaymentMethodStoreCreditRowsProps) {
  return (
    <>
      {savingsShouldRender ? (
        <Pressable
          onPress={onSavingsToggle}
          style={[
            styles.methodCard,
            {
              backgroundColor: colors.card,
              borderColor: savingsIsActive ? BRAND.primary : colors.border,
            },
          ]}
          accessibilityRole={savingsCoversFully ? 'radio' : 'checkbox'}
          accessibilityState={{ checked: savingsIsActive }}
          accessibilityLabel={savingsAccessibilityLabel}
        >
          <View
            style={[
              styles.methodIconContainer,
              {
                backgroundColor: savingsIsActive
                  ? `${BRAND.primary}20`
                  : `${colors.textSecondary}10`,
              },
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={24}
              color={savingsIsActive ? BRAND.primary : colors.textSecondary}
            />
          </View>

          <View style={styles.methodInfo}>
            <Text
              style={[
                styles.methodLabel,
                { color: savingsIsActive ? BRAND.primary : colors.text },
              ]}
            >
              {savingsCoversFully ? 'Pay with device savings' : 'Use device savings'}
            </Text>
            <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
              {savingsCoversFully
                ? `${formatPrice(savingsTotalBalance)} saved · covers full order`
                : `${formatPrice(savingsPortion)} from ${savingsGoalDisplayName} · ${formatPrice(savingsResidualToGateway)} remaining`}
            </Text>
          </View>

          <View
            style={[
              styles.radioOuter,
              {
                borderColor: savingsIsActive ? BRAND.primary : colors.border,
                borderRadius: savingsCoversFully ? 11 : 4,
              },
            ]}
          >
            {savingsIsActive ? (
              <View
                style={[
                  styles.radioInner,
                  styles.storeCreditIndicatorInner,
                  { borderRadius: savingsCoversFully ? 6 : 2 },
                ]}
              />
            ) : null}
          </View>
        </Pressable>
      ) : null}

      {walletStatusShouldRender ? (
        <WalletStatusRow colors={colors} isLoading={walletIsLoading} />
      ) : null}

      {walletInfoShouldRender ? (
        <View
          style={[
            styles.methodCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          accessibilityRole="text"
          accessibilityLabel={`Wallet balance applies automatically. ${formatPrice(walletPortion)} available now`}
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
              {`${formatPrice(walletPortion)} available now · transfer shortfall only`}
            </Text>
          </View>
        </View>
      ) : null}

      {walletShouldRender ? (
        <Pressable
          onPress={onWalletToggle}
          style={[
            styles.methodCard,
            {
              backgroundColor: colors.card,
              borderColor: walletIsActive ? BRAND.primary : colors.border,
            },
          ]}
          accessibilityRole={walletCoversFully ? 'radio' : 'checkbox'}
          accessibilityState={{ checked: walletIsActive }}
          accessibilityLabel={walletAccessibilityLabel}
        >
          <View
            style={[
              styles.methodIconContainer,
              {
                backgroundColor: walletIsActive
                  ? `${BRAND.primary}20`
                  : `${colors.textSecondary}10`,
              },
            ]}
          >
            <Ionicons
              name="wallet-outline"
              size={24}
              color={walletIsActive ? BRAND.primary : colors.textSecondary}
            />
          </View>

          <View style={styles.methodInfo}>
            <Text
              style={[
                styles.methodLabel,
                { color: walletIsActive ? BRAND.primary : colors.text },
              ]}
            >
              {walletCoversFully ? 'Pay with wallet' : 'Use wallet credit'}
            </Text>
            <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
              {walletCoversFully
                ? `${formatPrice(walletTotalBalance)} available · covers full order`
                : `${formatPrice(walletPortion)} from wallet · ${formatPrice(walletResidualToCard)} from card`}
            </Text>
          </View>

          <View
            style={[
              styles.radioOuter,
              {
                borderColor: walletIsActive ? BRAND.primary : colors.border,
                borderRadius: walletCoversFully ? 11 : 4,
              },
            ]}
          >
            {walletIsActive ? (
              <View
                style={[
                  styles.radioInner,
                  styles.storeCreditIndicatorInner,
                  { borderRadius: walletCoversFully ? 6 : 2 },
                ]}
              />
            ) : null}
          </View>
        </Pressable>
      ) : null}
    </>
  );
}
