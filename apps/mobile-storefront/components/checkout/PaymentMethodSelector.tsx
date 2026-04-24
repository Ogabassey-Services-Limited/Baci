/**
 * Payment Method Selector Component
 * Comprehensive payment options matching web storefront
 * Supports: Card (Paystack), Bank Transfer, Pay on Delivery, BNPL
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import creditDirectLogoSource from '@/assets/images/creditdirect.jpg';
import credpalLogoSource from '@/assets/images/credpal.png';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, palette, RADIUS, SPACING } from '@/constants/Colors';
import { formatPrice } from '@/stores/cart-store';

export type PaymentMethodType =
  | 'paystack'
  | 'korapay'
  | 'bank_transfer'
  | 'pay_on_delivery'
  | 'credpal'
  | 'credit_direct'
  | 'juicyway'
  | 'invoice'
  | 'payforme';

export type PaymentTab = 'full' | 'installments' | 'pay_later';

export interface PaymentMethod {
  id: PaymentMethodType;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  tab: PaymentTab;
  logoUrl?: string | number;
  disabled?: boolean;
  disabledReason?: string;
}

// BNPL eligibility constraints
const BNPL_MIN_AMOUNT = 10000; // ₦10,000
const BNPL_MAX_AMOUNT = 5000000; // ₦5,000,000
const INFO_PANEL_BACKGROUND_OPACITY = '10';

const PAYMENT_METHODS: PaymentMethod[] = [
  // Full Payment Methods
  {
    id: 'paystack',
    label: 'Pay with Card',
    description: 'Visa, Mastercard, Verve',
    icon: 'card-outline',
    tab: 'full',
  },
  {
    id: 'bank_transfer',
    label: 'Bank Transfer',
    description: 'Pay via direct bank transfer',
    icon: 'business-outline',
    tab: 'full',
  },
  {
    id: 'pay_on_delivery',
    label: 'Pay on Delivery',
    description: 'Cash or POS on delivery',
    icon: 'cash-outline',
    tab: 'full',
  },
  {
    id: 'juicyway',
    label: 'Pay with Crypto',
    description: 'USDT, USDC via Juicyway',
    icon: 'logo-bitcoin',
    tab: 'full',
  },
  // BNPL / Installment Methods
  {
    id: 'credit_direct',
    label: 'Credit Direct',
    description: 'Salary Earners and Business Owners',
    icon: 'wallet-outline',
    tab: 'installments',
    logoUrl: creditDirectLogoSource,
  },
  {
    id: 'credpal',
    label: 'CredPal',
    description: 'Salary Earners Only',
    icon: 'calendar-outline',
    tab: 'installments',
    logoUrl: credpalLogoSource,
  },
  {
    id: 'invoice',
    label: 'Generate Invoice',
    description: 'Create an invoice for later payment',
    icon: 'receipt-outline',
    tab: 'pay_later',
  },
  {
    id: 'payforme',
    label: 'Pay for Me',
    description: 'Create a payment request someone else can settle',
    icon: 'people-outline',
    tab: 'pay_later',
  },
];

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethodType;
  onSelectMethod: (method: PaymentMethodType) => void;
  selectedTab: PaymentTab;
  onSelectTab: (tab: PaymentTab) => void;
  orderTotal: number;
  showInstallmentCalculator?: boolean;
  enabledMethods?: PaymentMethodType[];
}

export function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
  selectedTab,
  onSelectTab,
  orderTotal,
  showInstallmentCalculator = true,
  enabledMethods,
}: PaymentMethodSelectorProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = (colorScheme ?? 'light') === 'dark';
  const warningBackground = isDark
    ? 'rgba(245, 158, 11, 0.12)'
    : palette.amber[100];
  const warningTextColor = isDark ? colors.text : palette.amber[800];
  const warningSubtleTextColor = isDark
    ? colors.textSecondary
    : palette.amber[800];

  // Check BNPL eligibility based on order total
  // Guard against null/undefined/NaN — BNPL requires a valid positive total
  const hasValidTotal =
    orderTotal != null && Number.isFinite(orderTotal) && orderTotal > 0;
  const isBNPLEligible =
    hasValidTotal &&
    orderTotal >= BNPL_MIN_AMOUNT &&
    orderTotal <= BNPL_MAX_AMOUNT;

  // Hide installments tab if no BNPL methods are enabled
  const hasBNPLMethods =
    !enabledMethods ||
    enabledMethods.some((m) => m === 'credpal' || m === 'credit_direct');
  const hasPayLaterMethods =
    !enabledMethods ||
    enabledMethods.some((m) => m === 'invoice' || m === 'payforme');

  const filteredMethods = PAYMENT_METHODS.filter((m) => m.tab === selectedTab)
    .filter((m) => !enabledMethods || enabledMethods.includes(m.id))
    .map((method) => {
      // Add eligibility check for BNPL methods
      if (method.tab === 'installments' && !isBNPLEligible) {
        const disabledReason =
          hasValidTotal && orderTotal > BNPL_MAX_AMOUNT
            ? `Maximum order: ${formatPrice(BNPL_MAX_AMOUNT)}`
            : `Minimum order: ${formatPrice(BNPL_MIN_AMOUNT)}`;
        return {
          ...method,
          disabled: true,
          disabledReason,
        };
      }
      return method;
    });

  useEffect(() => {
    if (selectedTab === 'installments' && !hasBNPLMethods) {
      onSelectTab('full');
      return;
    }

    if (selectedTab === 'pay_later' && !hasPayLaterMethods) {
      onSelectTab('full');
    }
  }, [selectedTab, hasBNPLMethods, hasPayLaterMethods, onSelectTab]);

  return (
    <View style={styles.container}>
      {/* Tab Selector — only show if BNPL methods are enabled */}
      {(hasBNPLMethods || hasPayLaterMethods) && (
        <View
          style={[styles.tabContainer, { backgroundColor: colors.card }]}
          accessibilityRole="tablist"
          accessibilityLabel="Payment type"
        >
          <Pressable
            style={[
              styles.tab,
              selectedTab === 'full' && [
                styles.activeTab,
                { backgroundColor: BRAND.primary },
              ],
            ]}
            onPress={() => onSelectTab('full')}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedTab === 'full' }}
            accessibilityLabel="Full payment"
          >
            <Text
              style={[
                styles.tabText,
                { color: selectedTab === 'full' ? colors.white : colors.text },
              ]}
            >
              Full Payment
            </Text>
          </Pressable>
          {hasBNPLMethods ? (
            <Pressable
              style={[
                styles.tab,
                selectedTab === 'installments' && [
                  styles.activeTab,
                  { backgroundColor: BRAND.primary },
                ],
              ]}
              onPress={() => onSelectTab('installments')}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedTab === 'installments' }}
              accessibilityLabel="Pay in installments"
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      selectedTab === 'installments'
                        ? colors.white
                        : colors.text,
                  },
                ]}
              >
                Pay in Installments
              </Text>
            </Pressable>
          ) : null}
          {hasPayLaterMethods ? (
            <Pressable
              style={[
                styles.tab,
                selectedTab === 'pay_later' && [
                  styles.activeTab,
                  { backgroundColor: BRAND.primary },
                ],
              ]}
              onPress={() => onSelectTab('pay_later')}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedTab === 'pay_later' }}
              accessibilityLabel="Pay later"
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      selectedTab === 'pay_later' ? colors.white : colors.text,
                  },
                ]}
              >
                Pay Later
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {/* Installment Calculator */}
      {selectedTab === 'installments' && showInstallmentCalculator && (
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
              <>
                <Text style={[styles.installmentTitle, { color: colors.text }]}>
                  Buy Now Pay Later
                </Text>
                <Text
                  style={[
                    styles.installmentDesc,
                    { color: colors.textSecondary },
                  ]}
                >
                  Split your order into 3-6 installments
                </Text>
                <Text
                  style={[
                    styles.installmentNote,
                    { color: colors.textSecondary },
                  ]}
                >
                  Interest rates vary. Breakdown shown during Checkout
                </Text>
              </>
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
      )}

      {selectedTab === 'pay_later' && (
        <View
          style={[
            styles.installmentInfo,
            {
              backgroundColor: `${BRAND.primary}${INFO_PANEL_BACKGROUND_OPACITY}`,
            },
          ]}
        >
          <Ionicons name="receipt-outline" size={20} color={BRAND.primary} />
          <View style={styles.installmentTextContainer}>
            <Text style={[styles.installmentTitle, { color: colors.text }]}>
              Flexible checkout
            </Text>
            <Text
              style={[styles.installmentDesc, { color: colors.textSecondary }]}
            >
              Generate an invoice now or prepare a payment request for someone
              else to settle later.
            </Text>
          </View>
        </View>
      )}

      {/* Payment Methods List */}
      <View
        style={styles.methodsContainer}
        accessibilityRole="radiogroup"
        accessibilityLabel="Payment methods"
        accessibilityLiveRegion="polite"
      >
        {filteredMethods.map((method) => {
          const isSelected = selectedMethod === method.id;
          const isDisabled = method.disabled;

          return (
            <Pressable
              key={method.id}
              style={[
                styles.methodCard,
                {
                  backgroundColor: colors.card,
                  borderColor: isSelected ? BRAND.primary : colors.border,
                  opacity: isDisabled ? 0.5 : 1,
                },
              ]}
              onPress={() => !isDisabled && onSelectMethod(method.id)}
              disabled={isDisabled}
              accessibilityRole="radio"
              accessibilityState={{
                checked: isSelected,
                disabled: isDisabled,
              }}
              accessibilityLabel={`${method.label}. ${isDisabled ? method.disabledReason : method.description}`}
            >
              <View
                style={[
                  styles.methodIconContainer,
                  {
                    backgroundColor: isSelected
                      ? `${BRAND.primary}20`
                      : `${colors.textSecondary}10`,
                  },
                ]}
              >
                {method.logoUrl ? (
                  <Image
                    source={method.logoUrl}
                    style={styles.methodLogo}
                    contentFit="contain"
                  />
                ) : (
                  <Ionicons
                    name={method.icon}
                    size={24}
                    color={isSelected ? BRAND.primary : colors.textSecondary}
                  />
                )}
              </View>

              <View style={styles.methodInfo}>
                <Text
                  style={[
                    styles.methodLabel,
                    { color: isSelected ? BRAND.primary : colors.text },
                  ]}
                >
                  {method.label}
                </Text>
                <Text
                  style={[styles.methodDesc, { color: colors.textSecondary }]}
                >
                  {isDisabled ? method.disabledReason : method.description}
                </Text>
              </View>

              <View
                style={[
                  styles.radioOuter,
                  { borderColor: isSelected ? BRAND.primary : colors.border },
                ]}
              >
                {isSelected && (
                  <View
                    style={[
                      styles.radioInner,
                      { backgroundColor: BRAND.primary },
                    ]}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Bank Transfer Info */}
      {selectedMethod === 'bank_transfer' && selectedTab === 'full' && (
        <View style={[styles.bankInfo, { backgroundColor: colors.card }]}>
          <Ionicons name="information-circle" size={18} color={BRAND.primary} />
          <Text style={[styles.bankInfoText, { color: colors.textSecondary }]}>
            A unique account number will be generated for this order. Payment
            confirms automatically.
          </Text>
        </View>
      )}

      {/* Pay on Delivery Info */}
      {selectedMethod === 'pay_on_delivery' && selectedTab === 'full' && (
        <View style={[styles.bankInfo, { backgroundColor: warningBackground }]}>
          <Ionicons name="warning" size={18} color={colors.warning} />
          <Text style={[styles.bankInfoText, { color: warningTextColor }]}>
            Available in Lagos only.
          </Text>
        </View>
      )}

      {/* Crypto Info */}
      {selectedMethod === 'juicyway' && selectedTab === 'full' && (
        <View
          style={[styles.bankInfo, { backgroundColor: `${BRAND.primary}10` }]}
        >
          <Ionicons name="logo-bitcoin" size={18} color={BRAND.primary} />
          <Text style={[styles.bankInfoText, { color: colors.textSecondary }]}>
            Pay with Bitcoin, Ethereum, USDT, or other cryptocurrencies. Payment
            is verified on the blockchain.
          </Text>
        </View>
      )}

      {selectedMethod === 'credit_direct' && selectedTab === 'installments' && (
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
      )}

      {selectedMethod === 'credpal' && selectedTab === 'installments' && (
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
      )}

      {selectedMethod === 'invoice' && selectedTab === 'pay_later' && (
        <View style={[styles.bankInfo, { backgroundColor: colors.card }]}>
          <Ionicons
            name="document-text-outline"
            size={18}
            color={BRAND.primary}
          />
          <Text style={[styles.bankInfoText, { color: colors.textSecondary }]}>
            We&apos;ll create an invoice for this order so you can complete
            payment later.
          </Text>
        </View>
      )}

      {selectedMethod === 'payforme' && selectedTab === 'pay_later' && (
        <View style={[styles.bankInfo, { backgroundColor: colors.card }]}>
          <Ionicons name="people-outline" size={18} color={BRAND.primary} />
          <Text style={[styles.bankInfoText, { color: colors.textSecondary }]}>
            We&apos;ll prepare this order for later payment so someone else can
            help complete it.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.md,
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    minHeight: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  installmentInfo: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  installmentTextContainer: {
    flex: 1,
  },
  installmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  installmentDesc: {
    fontSize: 13,
    marginBottom: SPACING.xs,
  },
  installmentExamples: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  installmentExample: {
    fontSize: 12,
    fontWeight: '600',
  },
  installmentNote: {
    fontSize: 11,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  methodsContainer: {
    gap: SPACING.sm,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 2,
  },
  methodIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodLogo: {
    width: 32,
    height: 32,
  },
  methodInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  methodDesc: {
    fontSize: 13,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  bankInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
