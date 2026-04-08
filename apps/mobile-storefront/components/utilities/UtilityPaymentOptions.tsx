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
import type { SavedVtuCard } from '@/lib/vtu-checkout';
import type { UtilityPaymentGateway } from '@/hooks/use-utility-payment';

interface UtilityPaymentOptionsProps {
  amount: number;
  cards: SavedVtuCard[];
  isLoadingCards: boolean;
  onSelectGateway: (gateway: UtilityPaymentGateway) => void;
  onSelectSavedCard: (cardId: string) => void;
  selectedGateway: UtilityPaymentGateway;
  selectedSavedCardId: string | null;
  supportedGateways: UtilityPaymentGateway[];
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
}: UtilityPaymentOptionsProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Payment Method
      </Text>

      {isLoadingCards ? (
        <ActivityIndicator color={BRAND.primary} style={styles.loader} />
      ) : cards.length > 0 ? (
        <View style={styles.cardsList}>
          {cards.map((card) => {
            const isSelected = selectedSavedCardId === card.id;
            return (
              <Pressable
                key={card.id}
                style={[
                  styles.savedCard,
                  {
                    backgroundColor: isSelected ? `${BRAND.primary}12` : colors.card,
                    borderColor: isSelected ? BRAND.primary : colors.border,
                  },
                ]}
                onPress={() => onSelectSavedCard(card.id)}
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
                    {card.exp_month && card.exp_year
                      ? `Expires ${card.exp_month}/${card.exp_year}`
                      : 'Saved for faster payment'}
                  </Text>
                </View>
                {card.is_default ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Default</Text>
                  </View>
                ) : null}
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
  savedCardCopy: {
    flex: 1,
    gap: 4,
  },
  savedCardMeta: {
    fontSize: 13,
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
});
