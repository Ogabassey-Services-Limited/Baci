import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PaymentMethodSelector } from '@/components/checkout/PaymentMethodSelector';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import type { UtilityPaymentGateway } from '@/hooks/use-utility-payment';
import type { SavedVtuCard } from '@/lib/vtu-checkout';
import type { WalletSelection } from '@/lib/wallet-payment-helpers';
import { UtilityPaystackTrustBadge } from './UtilityPaystackTrustBadge';

const WALLET_FUNDING_NUDGE =
  'Pay from your wallet to skip card fees — fund it by bank transfer to your account number.';
const WALLET_FUNDING_CTA = 'Fund wallet';

interface UtilityPaymentOptionsProps {
  amount: number;
  cards: SavedVtuCard[];
  isLoadingCards: boolean;
  onSelectGateway: (gateway: UtilityPaymentGateway) => void;
  onSelectSavedCard: (cardId: string) => void;
  selectedGateway: UtilityPaymentGateway;
  selectedSavedCardId: string | null;
  supportedGateways: UtilityPaymentGateway[];
  /**
   * Wallet payment opt-in. When `walletBalance > 0` AND the caller
   * passes `onWalletToggle`, PaymentMethodSelector renders a wallet
   * row (full-coverage radio when balance >= amount; partial-deduct
   * checkbox otherwise). Defaults align with `walletMode='off'` so
   * existing screens render unchanged until they opt in.
   */
  walletBalance?: number;
  walletError?: Error | null;
  walletIsLoading?: boolean;
  walletSelection?: WalletSelection;
  onWalletToggle?: (selection: WalletSelection) => void;
}

export function UtilityPaymentOptions({
  amount,
  cards,
  isLoadingCards,
  onSelectGateway,
  onSelectSavedCard,
  selectedGateway,
  selectedSavedCardId,
  supportedGateways,
  walletBalance,
  walletError,
  walletIsLoading,
  walletSelection,
  onWalletToggle,
}: UtilityPaymentOptionsProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const walletCoversBill =
    amount > 0 &&
    Number.isFinite(walletSelection?.amount) &&
    walletSelection?.use === true &&
    walletSelection.amount >= amount;
  const methodLabelOverrides =
    cards.length > 0 ? { paystack: 'Use another card' } : undefined;
  const hasPaystackOption =
    cards.length > 0 ||
    supportedGateways.some((gateway) => gateway === 'paystack');
  const showWalletFundingNudge =
    Boolean(onWalletToggle) &&
    walletIsLoading !== true &&
    !walletError &&
    amount > 0 &&
    (walletBalance ?? 0) < amount;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Payment Method
      </Text>
      {hasPaystackOption ? (
        <UtilityPaystackTrustBadge
          colors={colors}
          isDark={(colorScheme ?? 'light') === 'dark'}
        />
      ) : null}

      {showWalletFundingNudge ? (
        <View
          style={[
            styles.walletNudge,
            {
              backgroundColor: `${BRAND.primary}10`,
              borderColor: `${BRAND.primary}30`,
            },
          ]}
        >
          <Text style={[styles.walletNudgeText, { color: colors.text }]}>
            {WALLET_FUNDING_NUDGE}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={WALLET_FUNDING_CTA}
            onPress={() => router.push('/wallet')}
          >
            <Text style={styles.walletNudgeCta}>{WALLET_FUNDING_CTA}</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoadingCards ? (
        <ActivityIndicator color={BRAND.primary} style={styles.loader} />
      ) : cards.length > 0 ? (
        <View style={styles.cardsList}>
          {cards.map((card) => {
            const isSelected =
              !walletCoversBill && selectedSavedCardId === card.id;
            const savedCardMeta =
              card.exp_month && card.exp_year
                ? `Expires ${card.exp_month}/${card.exp_year}`
                : 'Saved for faster payment';
            return (
              <Pressable
                key={card.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${card.label}. ${savedCardMeta}`}
                style={[
                  styles.savedCard,
                  {
                    backgroundColor: isSelected
                      ? `${BRAND.primary}12`
                      : colors.card,
                    borderColor: isSelected ? BRAND.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  if (walletCoversBill && !onWalletToggle) {
                    return;
                  }
                  if (walletCoversBill) {
                    onWalletToggle?.({ amount: 0, use: false });
                  }
                  onSelectSavedCard(card.id);
                }}
              >
                <View style={styles.savedCardCopy}>
                  <Text style={[styles.savedCardTitle, { color: colors.text }]}>
                    {card.label}
                  </Text>
                  <Text
                    style={[
                      styles.savedCardMeta,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {savedCardMeta}
                  </Text>
                </View>
                <View style={styles.savedCardActions}>
                  {card.is_default ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Default</Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.savedCardRadioOuter,
                      {
                        borderColor: isSelected ? BRAND.primary : colors.border,
                      },
                    ]}
                  >
                    {isSelected ? (
                      <View style={styles.savedCardRadioInner} />
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <PaymentMethodSelector
        enabledMethods={supportedGateways}
        onSelectMethod={(method) => {
          if (method === 'paystack' || method === 'korapay') {
            onSelectGateway(method);
          }
        }}
        onSelectTab={() => undefined}
        orderTotal={amount}
        selectedMethod={selectedGateway}
        selectedTab="full"
        showInstallmentCalculator={false}
        suppressedSelectedMethods={
          selectedSavedCardId && !walletCoversBill ? ['paystack'] : undefined
        }
        methodLabelOverrides={methodLabelOverrides}
        walletMode={onWalletToggle ? 'vtu' : 'off'}
        walletBalance={walletBalance}
        walletError={walletError}
        walletIsLoading={walletIsLoading}
        walletOrderTotal={amount}
        walletSelection={walletSelection}
        onWalletToggle={onWalletToggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: BRAND.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardsList: {
    gap: 10,
    marginBottom: SPACING.lg,
  },
  container: {
    marginTop: SPACING.lg,
  },
  loader: {
    marginBottom: SPACING.md,
  },
  savedCard: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  savedCardActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  savedCardCopy: {
    flex: 1,
    gap: 4,
  },
  savedCardMeta: {
    fontSize: 13,
  },
  savedCardRadioInner: {
    backgroundColor: BRAND.primary,
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  savedCardRadioOuter: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  savedCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  walletNudge: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  walletNudgeCta: {
    color: BRAND.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  walletNudgeText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
