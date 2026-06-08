import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { showAppAlert } from '@/components/ui/show-app-alert';
import { setClipboardString } from '@/lib/clipboard';
import {
  createSavingsGoal,
  initializeSavingsAuthorization,
} from '@/lib/customer-savings';
import { WALLET_TOP_UP_MIN_AMOUNT } from '@/lib/wallet-top-up-constants';
import {
  cancelSavingsReminderNotification,
  scheduleSavingsReminderNotification,
} from '@/services/savings-reminder-notifications';
import type { SavingsFrequency } from './start-savings.helpers';
import { formatDateInput } from './start-savings.helpers';
import type {
  SavingsProductChoice,
  SavingsSourceMode,
} from './start-savings.types';
import {
  getErrorMessage,
  isInsufficientWalletError,
} from './start-savings-controller.utils';

type FundingAccount = {
  account_number: string;
} | null;

// Standard authorization amount used for card verification.
const CARD_AUTHORIZATION_AMOUNT = 100;

type UseStartSavingsSubmitInput = {
  activeMerchantId?: string;
  activeMerchantSlug?: string;
  contributionValue: number;
  effectiveInitialContribution: number;
  frequency: SavingsFrequency;
  fundingAccount: FundingAccount;
  initialContributionIdempotencyKey: string | null;
  maturityDate: string;
  normalizedVariantId?: string;
  refetch: () => Promise<unknown>;
  requiredTopUpAmount: number;
  selectedPaymentMethodId: string | null;
  selectedProduct: SavingsProductChoice | null;
  setFormError: (value: string | null) => void;
  setInitialContributionIdempotencyKey: (value: string | null) => void;
  setShowFundingModal: (value: boolean) => void;
  setShowPreviewModal: (value: boolean) => void;
  setShowSuccessModal: (value: boolean) => void;
  setShowTransferModal: (value: boolean) => void;
  sourceMode: SavingsSourceMode;
  startDate: string;
  targetValue: number;
};

type SavingsInputValidation =
  | {
      formattedStartDate: string;
      ok: true;
      selectedProduct: SavingsProductChoice;
    }
  | { error: string; ok: false };

function validateSavingsInput(
  input: UseStartSavingsSubmitInput
): SavingsInputValidation {
  if (!input.selectedProduct) {
    return { error: 'Select a product to save for.', ok: false };
  }

  if (input.sourceMode === 'auto_debit' && !input.selectedPaymentMethodId) {
    return { error: 'Select a saved card for auto debit.', ok: false };
  }

  const formattedStartDate = formatDateInput(input.startDate);
  if (!formattedStartDate) {
    return { error: 'Select a valid start date.', ok: false };
  }

  return {
    formattedStartDate,
    ok: true,
    selectedProduct: input.selectedProduct,
  };
}

export function useStartSavingsSubmit(input: UseStartSavingsSubmitInput) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAuthorizingCard, setIsAuthorizingCard] = useState(false);
  const authorizationInFlightRef = useRef(false);
  const submitInFlightRef = useRef(false);

  const submitSavingsGoal = async () => {
    if (submitInFlightRef.current) {
      return;
    }

    const validation = validateSavingsInput(input);
    if (!validation.ok) {
      input.setFormError(validation.error);
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    try {
      const requestInitialContribution =
        input.sourceMode === 'auto_debit'
          ? 0
          : input.effectiveInitialContribution;
      // Auto-debit savings starts with requestInitialContribution = 0, so no
      // requestIdempotencyKey is needed. Manual contributions reuse
      // input.initialContributionIdempotencyKey; only a missing key is created
      // with Crypto.randomUUID and persisted through input.setInitialContributionIdempotencyKey.
      const requestIdempotencyKey =
        requestInitialContribution > 0
          ? (input.initialContributionIdempotencyKey ?? Crypto.randomUUID())
          : undefined;
      if (requestIdempotencyKey && !input.initialContributionIdempotencyKey) {
        input.setInitialContributionIdempotencyKey(requestIdempotencyKey);
      }
      const result = await createSavingsGoal({
        autoDebitAuthorized:
          input.sourceMode === 'auto_debit' ? true : undefined,
        contributionAmount: input.contributionValue,
        contributionFrequency: input.frequency,
        initialContributionAmount: requestInitialContribution,
        initialContributionIdempotencyKey: requestIdempotencyKey,
        maturityDate: input.maturityDate,
        merchantId: input.activeMerchantId,
        merchantSlug: input.activeMerchantSlug,
        nonWithdrawableAccepted: true,
        productId: validation.selectedProduct.id,
        savedPaymentMethodId:
          input.sourceMode === 'auto_debit'
            ? input.selectedPaymentMethodId
            : null,
        sourceMode: input.sourceMode,
        startDate: validation.formattedStartDate,
        targetAmount: input.targetValue,
        termsAccepted: true,
        title: validation.selectedProduct.name,
        variantId: input.normalizedVariantId ?? null,
      });
      if (!result.success) {
        throw new Error('Unable to create savings plan.');
      }
      if (input.sourceMode === 'manual') {
        try {
          if (input.targetValue > requestInitialContribution) {
            await scheduleSavingsReminderNotification({
              contributionAmount: input.contributionValue,
              frequency: input.frequency,
              goalId: result.goalId,
              goalTitle: validation.selectedProduct.name,
            });
          } else {
            await cancelSavingsReminderNotification(result.goalId);
          }
        } catch {
          // Reminder scheduling is best effort and must not block goal creation.
        }
      }
      input.setShowFundingModal(false);
      input.setShowPreviewModal(false);
      input.setShowTransferModal(false);
      input.setFormError(null);
      input.setInitialContributionIdempotencyKey(null);
      input.setShowSuccessModal(true);
      try {
        await input.refetch();
      } catch {
        input.setFormError('Plan created but unable to refresh wallet data.');
      }
    } catch (error) {
      if (isInsufficientWalletError(error) && input.fundingAccount) {
        input.setShowTransferModal(true);
        return;
      }
      const message = getErrorMessage(error, 'Unable to create savings plan.');
      input.setFormError(message);
      showAppAlert({
        title: 'Unable to create plan',
        message,
        variant: 'error',
      });
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleAuthorizeSavingsCard = async () => {
    if (authorizationInFlightRef.current) {
      return;
    }

    authorizationInFlightRef.current = true;
    setIsAuthorizingCard(true);
    try {
      const result = await initializeSavingsAuthorization({
        amount: CARD_AUTHORIZATION_AMOUNT,
        merchantId: input.activeMerchantId,
        merchantSlug: input.activeMerchantSlug,
      });
      input.setShowFundingModal(false);
      router.push({
        pathname: '/payment-gateway',
        params: {
          authorizationUrl: result.authorization_url,
          gateway: result.gateway,
          merchantId: input.activeMerchantId,
          merchantSlug: input.activeMerchantSlug,
          paymentKind: 'savings_auth',
          reference: result.reference,
          returnTo: '/wallet/savings/start',
        },
      });
    } catch (error) {
      showAppAlert({
        title: 'Unable to authorize card',
        message: getErrorMessage(
          error,
          'Unable to start Paystack card authorization.'
        ),
        variant: 'error',
      });
    } finally {
      authorizationInFlightRef.current = false;
      setIsAuthorizingCard(false);
    }
  };

  const handleCopyFundingAccount = async () => {
    if (!input.fundingAccount) {
      return;
    }
    const copied = await setClipboardString(
      input.fundingAccount.account_number
    );
    showAppAlert({
      title: copied ? 'Copied' : 'Unable to copy',
      message: copied
        ? 'Account number copied to clipboard.'
        : 'Unable to copy account number.',
      variant: copied ? 'success' : 'error',
    });
  };

  return {
    goToWallet: () =>
      router.replace({
        pathname: '/wallet',
        params: { action: 'savings' },
      }),
    handleAuthorizeSavingsCard,
    handleCopyFundingAccount,
    isAuthorizingCard,
    isSubmitting,
    openWalletFundingScreen: () => {
      // Fund enough for the first contribution, but never send Paystack below the provider minimum.
      const maxNeeded = Math.max(
        input.requiredTopUpAmount,
        input.contributionValue
      );
      const requiredAmount = Math.max(
        WALLET_TOP_UP_MIN_AMOUNT,
        Math.ceil(maxNeeded)
      );

      return router.push({
        pathname: '/wallet',
        params: {
          action: 'fund',
          requiredAmount: String(requiredAmount),
          returnTo: '/wallet/savings/start',
        },
      });
    },
    submitSavingsGoal,
  };
}
