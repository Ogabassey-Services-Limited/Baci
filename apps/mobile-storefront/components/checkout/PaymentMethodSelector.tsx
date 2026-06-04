import { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { palette } from '@/constants/Colors';
import { formatPrice } from '@/stores/cart-store';
import { PaymentMethodOptionRow } from './payment-method-selector/PaymentMethodOptionRow';
import { PaymentMethodStatusPanels } from './payment-method-selector/PaymentMethodStatusPanels';
import { PaymentMethodStoreCreditRows } from './payment-method-selector/PaymentMethodStoreCreditRows';
import { PaymentMethodTabSelector } from './payment-method-selector/PaymentMethodTabSelector';
import { paymentMethodSelectorStyles as styles } from './payment-method-selector/styles';
import {
  DEFAULT_SAVINGS_FALLBACK_TITLE,
  type PaymentMethodSelectorProps,
} from './payment-method-selector/types';
import { usePaymentMethodAvailability } from './payment-method-selector/usePaymentMethodAvailability';

export type {
  PaymentMethod,
  PaymentMethodSelectorProps,
  PaymentMethodType,
  PaymentTab,
  SavingsSelection,
  WalletMode,
  WalletSelection,
} from './payment-method-selector/types';

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
  const { height, width } = useWindowDimensions();
  const hasMeasuredWindow = width > 0 && height > 0;
  const isCompactPaymentLayout =
    hasMeasuredWindow && (width < 390 || (width > height && height < 520));
  const warningBackground = isDark
    ? 'rgba(245, 158, 11, 0.12)'
    : palette.amber[100];
  const warningTextColor = isDark ? colors.text : palette.amber[800];
  const warningSubtleTextColor = isDark
    ? colors.textSecondary
    : palette.amber[800];

  const {
    filteredMethods,
    hasBNPLMethods,
    hasPayLaterMethods,
    hasValidTotal,
    isBNPLEligible,
    supportsPartialPayment,
  } = usePaymentMethodAvailability({
    enabledMethods,
    methodDisabledReasons,
    orderTotal,
    selectedMethod,
    selectedTab,
    walletSelection,
    savingsSelection,
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
  const savingsAccessibilityLabel = savingsCoversFully
    ? `Pay with device savings, ${formatPrice(savingsBalance)} available`
    : `Use device savings, ${formatPrice(savingsPortion)} of ${formatPrice(orderTotal)}`;

  const walletEffectiveTotal = Math.max(
    (walletOrderTotal ?? orderTotal) - activeSavingsAmount,
    0
  );
  const walletAttemptAllowed =
    (walletMode === 'orders' || walletMode === 'vtu') &&
    walletEffectiveTotal > 0 &&
    supportsPartialPayment;
  const walletCoversTotal = walletBalance >= walletEffectiveTotal;
  const walletFundedBankTransferActive =
    walletFundedBankTransferMode &&
    selectedMethod === 'bank_transfer' &&
    selectedTab === 'full';
  const walletShouldRender =
    walletAttemptAllowed &&
    (!walletFundedBankTransferActive || walletCoversTotal) &&
    walletBalance > 0 &&
    !walletIsLoading &&
    walletError === null;
  const walletInfoShouldRender =
    walletAttemptAllowed &&
    walletFundedBankTransferActive &&
    walletBalance > 0 &&
    !walletCoversTotal &&
    !walletIsLoading &&
    walletError === null;
  const walletStatusShouldRender =
    walletAttemptAllowed &&
    !walletShouldRender &&
    (walletIsLoading || walletError !== null);
  const walletCoversFully = walletShouldRender && walletCoversTotal;
  const walletPortion =
    walletShouldRender || walletInfoShouldRender
      ? Math.min(walletBalance, walletEffectiveTotal)
      : 0;
  const walletResidualToCard = walletShouldRender
    ? Math.max(walletEffectiveTotal - walletBalance, 0)
    : 0;
  const walletIsActive = walletSelection?.use === true;
  const walletAccessibilityLabel = walletCoversFully
    ? `Pay with wallet, ${formatPrice(walletBalance)} available`
    : `Use wallet credit, ${formatPrice(walletPortion)} of ${formatPrice(walletEffectiveTotal)}`;

  return (
    <View style={styles.container}>
      <PaymentMethodStoreCreditRows
        colors={colors}
        onSavingsToggle={
          onSavingsToggle
            ? () =>
                onSavingsToggle(
                  savingsIsActive
                    ? { use: false, goalId: null, amount: 0 }
                    : {
                        use: true,
                        goalId: savingsGoalId ?? null,
                        amount: savingsPortion,
                      }
                )
            : undefined
        }
        onWalletToggle={
          onWalletToggle
            ? () =>
                onWalletToggle(
                  walletIsActive
                    ? { use: false, amount: 0 }
                    : { use: true, amount: walletPortion }
                )
            : undefined
        }
        savingsAccessibilityLabel={savingsAccessibilityLabel}
        savingsCoversFully={savingsCoversFully}
        savingsGoalDisplayName={savingsGoalDisplayName}
        savingsIsActive={savingsIsActive}
        savingsPortion={savingsPortion}
        savingsResidualToGateway={savingsResidualToGateway}
        savingsShouldRender={savingsShouldRender}
        savingsTotalBalance={savingsBalance}
        walletAccessibilityLabel={walletAccessibilityLabel}
        walletCoversFully={walletCoversFully}
        walletInfoShouldRender={walletInfoShouldRender}
        walletIsActive={walletIsActive}
        walletIsLoading={walletIsLoading}
        walletPortion={walletPortion}
        walletResidualToCard={walletResidualToCard}
        walletShouldRender={walletShouldRender}
        walletStatusShouldRender={walletStatusShouldRender}
        walletTotalBalance={walletBalance}
      />

      <PaymentMethodTabSelector
        colors={colors}
        compact={isCompactPaymentLayout}
        hasBNPLMethods={hasBNPLMethods}
        hasPayLaterMethods={hasPayLaterMethods}
        onSelectTab={onSelectTab}
        selectedTab={selectedTab}
      />

      <View
        style={styles.methodsContainer}
        accessibilityRole="radiogroup"
        accessibilityLabel="Payment methods"
        accessibilityLiveRegion="polite"
      >
        {filteredMethods.map((method) => {
          const savingsSuppressesGateway =
            savingsCoversFully && savingsIsActive;
          const walletSuppressesGateway = walletCoversFully && walletIsActive;
          const selectionSuppressed = suppressedSelectedMethods.includes(
            method.id
          );
          const isSelected =
            selectedMethod === method.id &&
            !walletSuppressesGateway &&
            !savingsSuppressesGateway &&
            !selectionSuppressed;
          const isDisabled = Boolean(
            method.disabled ||
              walletSuppressesGateway ||
              savingsSuppressesGateway
          );
          return (
            <PaymentMethodOptionRow
              key={method.id}
              colors={colors}
              isDisabled={isDisabled}
              isSelected={isSelected}
              method={method}
              onPress={onSelectMethod}
              overrideBadge={methodBadgeOverrides[method.id]}
              overrideDescription={methodDescriptionOverrides[method.id]}
              overrideLabel={methodLabelOverrides[method.id]}
            />
          );
        })}
      </View>

      <PaymentMethodStatusPanels
        colors={colors}
        hasValidTotal={hasValidTotal}
        isBNPLEligible={isBNPLEligible}
        orderTotal={orderTotal}
        selectedMethod={selectedMethod}
        selectedTab={selectedTab}
        showInstallmentCalculator={showInstallmentCalculator}
        warningBackground={warningBackground}
        warningSubtleTextColor={warningSubtleTextColor}
        warningTextColor={warningTextColor}
        walletFundedBankTransferMode={walletFundedBankTransferMode}
      />
    </View>
  );
}
