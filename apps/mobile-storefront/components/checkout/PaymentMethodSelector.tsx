import Ionicons, { type IoniconsIconName } from "@react-native-vector-icons/ionicons";
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import creditDirectLogoSource from '@/assets/images/creditdirect.jpg';
import credpalLogoSource from '@/assets/images/credpal.png';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, palette, RADIUS, SPACING } from '@/constants/Colors';
import type {
  SavingsSelection,
  WalletSelection,
} from '@/lib/wallet-payment-helpers';
import { isStoreCreditCompatiblePayment } from '@/lib/store-credit-compatible-payment';
import { formatPrice } from '@/stores/cart-store';
import { WalletPayment } from './WalletPayment';
import { getWalletPaymentState } from './wallet-payment-state';

export type { SavingsSelection, WalletSelection };

export type PaymentMethodType =
  | 'paystack'
  | 'korapay'
  | 'bank_transfer'
  | 'pay_on_delivery'
  | 'credpal'
  | 'credit_direct'
  | 'klump'
  | 'juicyway'
  | 'invoice'
  | 'payforme';

export type PaymentTab = 'full' | 'installments' | 'pay_later';

export interface PaymentMethod {
  id: PaymentMethodType;
  label: string;
  description: string;
  icon: IoniconsIconName;
  tab: PaymentTab;
  logoUrl?: string | number;
  disabled?: boolean;
  disabledReason?: string;
}

// BNPL eligibility constraints
const BNPL_MIN_AMOUNT = 10000; // ₦10,000
const BNPL_MAX_AMOUNT = 5000000; // ₦5,000,000
const INFO_PANEL_BACKGROUND_OPACITY = '10';
const DEFAULT_SAVINGS_FALLBACK_TITLE = 'device savings';

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
    id: 'klump',
    label: 'Klump',
    description: 'Buy now, pay in installments',
    icon: 'wallet-outline',
    tab: 'installments',
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

/**
 * `walletMode` opts a caller into wallet payment UI. Defaults to `'off'`,
 * which is what every existing caller gets without any changes.
 *
 * - `'orders'`: PR A — storefront order checkout.
 * - `'vtu'`:    PR B — VTU/bills checkout (UtilityPaymentOptions).
 * - `'off'`:    no wallet row rendered (default).
 *
 * The selector is presentation-only. The caller is responsible for
 * fetching wallet balance via `useWallet()` and passing it as
 * `walletBalance`. Keeping the hook out of the shared component is what
 * makes `walletMode='off'` an effective hard gate.
 */
export type WalletMode = 'orders' | 'vtu' | 'off';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethodType;
  onSelectMethod: (method: PaymentMethodType) => void;
  selectedTab: PaymentTab;
  onSelectTab: (tab: PaymentTab) => void;
  orderTotal: number;
  showInstallmentCalculator?: boolean;
  enabledMethods?: PaymentMethodType[];
  walletMode?: WalletMode;
  walletBalance?: number;
  walletError?: Error | null;
  walletIsLoading?: boolean;
  walletOrderTotal?: number;
  walletSelection?: WalletSelection;
  onWalletToggle?: (selection: WalletSelection) => void;
  savingsBalance?: number;
  savingsFallbackTitle?: string;
  savingsGoalId?: string | null;
  savingsGoalTitle?: string;
  savingsSelection?: SavingsSelection;
  onSavingsToggle?: (selection: SavingsSelection) => void;
  suppressedSelectedMethods?: PaymentMethodType[];
  methodBadgeOverrides?: Partial<Record<PaymentMethodType, string>>;
  methodDescriptionOverrides?: Partial<Record<PaymentMethodType, string>>;
  methodDisabledReasons?: Partial<Record<PaymentMethodType, string>>;
  methodLabelOverrides?: Partial<Record<PaymentMethodType, string>>;
  walletFundedBankTransferMode?: boolean;
}

export function PaymentMethodSelector({
  selectedMethod,
  onSelectMethod,
  selectedTab,
  onSelectTab,
  orderTotal,
  showInstallmentCalculator = true,
  enabledMethods,
  walletMode = 'off',
  walletBalance = 0,
  walletError = null,
  walletIsLoading = false,
  walletOrderTotal,
  walletSelection,
  onWalletToggle,
  savingsBalance = 0,
  savingsFallbackTitle = DEFAULT_SAVINGS_FALLBACK_TITLE,
  savingsGoalId,
  savingsGoalTitle,
  savingsSelection,
  onSavingsToggle,
  suppressedSelectedMethods = [],
  methodBadgeOverrides = {},
  methodDescriptionOverrides = {},
  methodDisabledReasons = {},
  methodLabelOverrides = {},
  walletFundedBankTransferMode = false,
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
    enabledMethods.some(
      (m) => m === 'credpal' || m === 'credit_direct' || m === 'klump'
    );
  const hasPayLaterMethods =
    !enabledMethods ||
    enabledMethods.some((m) => m === 'invoice' || m === 'payforme');

  const filteredMethods = PAYMENT_METHODS.filter((m) => m.tab === selectedTab)
    .filter((m) => !enabledMethods || enabledMethods.includes(m.id))
    .map((method) => {
      const walletDisablesKlump =
        method.id === 'klump' &&
        walletSelection?.use === true &&
        (walletSelection.amount ?? 0) > 0;
      if (walletDisablesKlump) {
        return {
          ...method,
          disabled: true,
          disabledReason: 'Wallet credit cannot be combined with Klump',
        };
      }

      const savingsDisablesKlump =
        method.id === 'klump' &&
        savingsSelection?.use === true &&
        (savingsSelection.amount ?? 0) > 0;
      if (savingsDisablesKlump) {
        return {
          ...method,
          disabled: true,
          disabledReason: 'Device savings cannot be combined with Klump',
        };
      }

      const disabledReason = methodDisabledReasons[method.id];
      if (disabledReason) {
        return {
          ...method,
          disabled: true,
          disabledReason,
        };
      }

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

  const supportsPartialPayment = isStoreCreditCompatiblePayment({
    paymentTab: selectedTab,
    selectedPayment: selectedMethod,
  });

  // === Device savings row ===
  // Shows only for checkout methods that can settle any residual in real
  // time. Savings is applied before wallet, so the wallet row below reads
  // the residual after savings when both toggles are active.
  const savingsShouldRender =
    Boolean(savingsGoalId) &&
    savingsBalance > 0 &&
    orderTotal > 0 &&
    selectedTab === 'full' &&
    supportsPartialPayment;
  const savingsCoversFully =
    savingsShouldRender && savingsBalance >= orderTotal;
  const savingsPortion = savingsShouldRender
    ? Math.min(savingsBalance, orderTotal)
    : 0;
  const savingsResidualToGateway = savingsShouldRender
    ? Math.max(orderTotal - savingsBalance, 0)
    : 0;
  const savingsIsActive =
    savingsSelection?.use === true &&
    Boolean(savingsGoalId) &&
    savingsSelection.goalId === savingsGoalId;
  const activeSavingsAmount = savingsIsActive ? savingsPortion : 0;
  const savingsGoalDisplayName = savingsGoalTitle ?? savingsFallbackTitle;

  const handleSavingsToggle = () => {
    if (!onSavingsToggle) {
      return;
    }
    if (savingsIsActive) {
      onSavingsToggle({ use: false, goalId: null, amount: 0 });
    } else {
      onSavingsToggle({
        use: true,
        goalId: savingsGoalId ?? null,
        amount: savingsPortion,
      });
    }
  };

  const savingsAccessibilityLabel = savingsCoversFully
    ? `Pay with device savings, ${formatPrice(savingsBalance)} available`
    : `Use device savings, ${formatPrice(savingsPortion)} of ${formatPrice(orderTotal)}`;

  const walletPaymentState = getWalletPaymentState({
    activeSavingsAmount,
    orderTotal,
    selectedMethod,
    selectedTab,
    supportsPartialPayment,
    walletBalance,
    walletError,
    walletFundedBankTransferMode,
    walletIsLoading,
    walletMode,
    walletOrderTotal,
    walletSelection,
  });

  return (
    <View style={styles.container}>
      {savingsShouldRender && (
        <Pressable
          onPress={handleSavingsToggle}
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
              {savingsCoversFully
                ? 'Pay with device savings'
                : 'Use device savings'}
            </Text>
            <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
              {savingsCoversFully
                ? `${formatPrice(savingsBalance)} saved · covers full order`
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
            {savingsIsActive && (
              <View
                style={[
                  styles.radioInner,
                  {
                    backgroundColor: BRAND.primary,
                    borderRadius: savingsCoversFully ? 6 : 2,
                  },
                ]}
              />
            )}
          </View>
        </Pressable>
      )}

      <WalletPayment
        colors={colors}
        onWalletToggle={onWalletToggle}
        state={walletPaymentState}
        walletBalance={walletBalance}
        walletIsLoading={walletIsLoading}
      />

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
              selectedTab === 'full' && { backgroundColor: BRAND.primary },
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
                selectedTab === 'installments' && {
                  backgroundColor: BRAND.primary,
                },
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
                selectedTab === 'pay_later' && {
                  backgroundColor: BRAND.primary,
                },
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
          // When wallet fully covers the order AND the user has the
          // wallet row toggled on, the gateway list becomes informational
          // — there's no residual to settle. Suppress the active-radio
          // visual on every gateway row so the picker doesn't show two
          // competing "selected" indicators. The underlying selectedMethod
          // is preserved so it can still be sent to the server for
          // receipt/accounting purposes.
          const savingsSuppressesGateway =
            savingsCoversFully && savingsIsActive;
          const walletSuppressesGateway =
            walletPaymentState.coversFully && walletPaymentState.isActive;
          const selectionSuppressed = suppressedSelectedMethods.includes(
            method.id
          );
          const isSelected =
            selectedMethod === method.id &&
            !walletSuppressesGateway &&
            !savingsSuppressesGateway &&
            !selectionSuppressed;
          const isDisabled =
            method.disabled ||
            walletSuppressesGateway ||
            savingsSuppressesGateway;
          const methodBadge = methodBadgeOverrides[method.id];
          const methodDescription =
            methodDescriptionOverrides[method.id] ?? method.description;
          const methodLabel = methodLabelOverrides[method.id] ?? method.label;

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
              accessibilityLabel={`${methodLabel}. ${isDisabled ? method.disabledReason : methodDescription}`}
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
                <View style={styles.methodTitleRow}>
                  <Text
                    style={[
                      styles.methodLabel,
                      { color: isSelected ? BRAND.primary : colors.text },
                    ]}
                  >
                    {methodLabel}
                  </Text>
                  {methodBadge ? (
                    <View style={styles.methodBadge}>
                      <Text style={styles.methodBadgeText}>{methodBadge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[styles.methodDesc, { color: colors.textSecondary }]}
                >
                  {isDisabled ? method.disabledReason : methodDescription}
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
            {walletFundedBankTransferMode
              ? 'We will fund your wallet and pay this order automatically.'
              : 'A unique account number will be generated for this order. Payment confirms automatically.'}
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
    paddingHorizontal: SPACING.xs,
    minHeight: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
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
  methodBadge: {
    backgroundColor: `${BRAND.primary}20`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  methodBadgeText: {
    color: BRAND.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  methodLabel: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  methodTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
