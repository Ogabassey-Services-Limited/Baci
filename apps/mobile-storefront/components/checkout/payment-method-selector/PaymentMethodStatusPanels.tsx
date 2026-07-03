import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { formatPrice } from '@/stores/cart-store';
import { paymentMethodSelectorStyles as styles } from './styles';
import {
  BNPL_MAX_AMOUNT,
  BNPL_MIN_AMOUNT,
  INFO_PANEL_BACKGROUND_OPACITY,
  type PaymentMethodType,
  type PaymentTab,
} from './types';

type ThemeColors = (typeof Colors)['light'];

interface PaymentMethodStatusPanelsProps {
  colors: ThemeColors;
  hasValidTotal: boolean;
  isBNPLEligible: boolean;
  orderTotal: number;
  selectedMethod: PaymentMethodType;
  selectedTab: PaymentTab;
  showInstallmentCalculator: boolean;
  warningBackground: string;
  warningSubtleTextColor: string;
  warningTextColor: string;
  walletFundedBankTransferMode: boolean;
}

export function PaymentMethodStatusPanels({
  colors,
  hasValidTotal,
  isBNPLEligible,
  orderTotal,
  selectedMethod,
  selectedTab,
  showInstallmentCalculator,
  warningBackground,
  warningSubtleTextColor,
  warningTextColor,
  walletFundedBankTransferMode,
}: PaymentMethodStatusPanelsProps) {
  return (
    <>
      {selectedTab === 'installments' && showInstallmentCalculator ? (
        <View
          style={[
            styles.installmentInfo,
            {
              backgroundColor: isBNPLEligible
                ? `${BRAND.primary}10`
                : warningBackground,
            },
          ]}
        >
          <Ionicons
            name={isBNPLEligible ? 'information-circle' : 'warning'}
            size={20}
            color={isBNPLEligible ? BRAND.primary : colors.warning}
          />
          <View style={styles.installmentTextContainer}>
            {isBNPLEligible ? (
              <Text
                style={[styles.installmentDesc, { color: colors.textSecondary }]}
              >
                Interest rates vary. Breakdown shown during Checkout
              </Text>
            ) : (
              <>
                <Text
                  style={[styles.installmentTitle, { color: warningTextColor }]}
                >
                  {!hasValidTotal || orderTotal < BNPL_MIN_AMOUNT
                    ? 'Minimum Order Required'
                    : 'Maximum Order Exceeded'}
                </Text>
                <Text
                  style={[
                    styles.installmentDesc,
                    { color: warningSubtleTextColor },
                  ]}
                >
                  {!hasValidTotal || orderTotal < BNPL_MIN_AMOUNT
                    ? `BNPL is available for orders above ${formatPrice(BNPL_MIN_AMOUNT)}.`
                    : `BNPL is available for orders up to ${formatPrice(BNPL_MAX_AMOUNT)}.`}
                </Text>
              </>
            )}
          </View>
        </View>
      ) : null}

      {selectedMethod === 'bank_transfer' && selectedTab === 'full' ? (
        <View style={[styles.bankInfo, { backgroundColor: colors.card }]}>
          <Ionicons name="information-circle" size={18} color={BRAND.primary} />
          <Text style={[styles.bankInfoText, { color: colors.textSecondary }]}>
            {walletFundedBankTransferMode
              ? 'We will fund your wallet and pay this order automatically.'
              : 'A unique account number will be generated for this order. Payment confirms automatically.'}
          </Text>
        </View>
      ) : null}

      {selectedMethod === 'pay_on_delivery' && selectedTab === 'full' ? (
        <View style={[styles.bankInfo, { backgroundColor: warningBackground }]}>
          <Ionicons name="warning" size={18} color={colors.warning} />
          <Text style={[styles.bankInfoText, { color: warningTextColor }]}>
            Available in Lagos only.
          </Text>
        </View>
      ) : null}

      {selectedMethod === 'juicyway' && selectedTab === 'full' ? (
        <View
          style={[styles.bankInfo, { backgroundColor: `${BRAND.primary}10` }]}
        >
          <Ionicons name="logo-bitcoin" size={18} color={BRAND.primary} />
          <Text style={[styles.bankInfoText, { color: colors.textSecondary }]}>
            Pay with Bitcoin, Ethereum, USDT, or other cryptocurrencies. Payment
            is verified on the blockchain.
          </Text>
        </View>
      ) : null}

      {selectedMethod === 'credit_direct' && selectedTab === 'installments' ? (
        <View
          style={[
            styles.bankInfo,
            {
              backgroundColor: `${BRAND.primary}${INFO_PANEL_BACKGROUND_OPACITY}`,
            },
          ]}
        >
          <Ionicons name="wallet-outline" size={18} color={BRAND.primary} />
          <Text style={[styles.bankInfoText, { color: colors.textSecondary }]}>
            Salary Earners and Business Owners. 25-40% downpayment.
          </Text>
        </View>
      ) : null}

      {selectedMethod === 'credpal' && selectedTab === 'installments' ? (
        <View
          style={[
            styles.bankInfo,
            {
              backgroundColor: `${BRAND.primary}${INFO_PANEL_BACKGROUND_OPACITY}`,
            },
          ]}
        >
          <Ionicons name="calendar-outline" size={18} color={BRAND.primary} />
          <Text style={[styles.bankInfoText, { color: colors.textSecondary }]}>
            Salary Earners Only. 30-40% downpayment.
          </Text>
        </View>
      ) : null}

    </>
  );
}
