import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDebounce } from '@/hooks/use-debounce';
import { useProducts } from '@/hooks/use-products';
import { useWallet } from '@/hooks/use-wallet';
import { CONFIG } from '@/lib/config';
import { pickMerchantId } from '@/lib/pick-merchant-id';
import { useAuthStore } from '@/stores/auth-store';
import type { Product } from '@/types/product';
import {
  calculateMaturityDate,
  formatDateInput,
  getEffectiveInitialContribution,
  getRequiredTopUp,
  getTodayIsoDate,
  normalizeAmountInput,
  parseAmount,
  type SavingsFrequency,
  type SavingsFundingOption,
} from './start-savings.helpers';
import type {
  SavingsProductChoice,
  SavingsSearchParams,
  SavingsSourceMode,
} from './start-savings.types';
import {
  applyStartSavingsProductSelection,
  readParam,
  validateStartSavingsForm,
} from './start-savings-controller.utils';
import { useStartSavingsPaymentMethods } from './use-start-savings-payment-methods';
import { useStartSavingsSubmit } from './use-start-savings-submit';

const DEFAULT_PREFERRED_DEBIT_TIME = '06:20';

export function useStartSavingsController() {
  const params = useLocalSearchParams<SavingsSearchParams>();
  const { merchantId } = useAuthStore(
    useShallow((state) => ({ merchantId: state.merchantId }))
  );
  const { data: walletData, isRefetching, refetch } = useWallet();
  const [searchValue, setSearchValue] = useState('');
  const [selectedProduct, setSelectedProduct] =
    useState<SavingsProductChoice | null>(null);
  const [targetAmount, setTargetAmount] = useState(
    readParam(params.targetAmount) ?? ''
  );
  const [contributionAmount, setContributionAmount] = useState('');
  const [frequency, setFrequency] = useState<SavingsFrequency>('daily');
  const [preferredDebitTime, setPreferredDebitTime] = useState(
    DEFAULT_PREFERRED_DEBIT_TIME
  );
  const [startDate, setStartDate] = useState(getTodayIsoDate());
  const [initialContributionEnabled, setInitialContributionEnabled] =
    useState(false);
  const [initialContributionAmount, setInitialContributionAmount] =
    useState('');
  const [
    initialContributionIdempotencyKey,
    setInitialContributionIdempotencyKey,
  ] = useState<string | null>(null);
  const [acceptsNonWithdrawableTerms, setAcceptsNonWithdrawableTerms] =
    useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedFundingOption, setSelectedFundingOption] =
    useState<SavingsFundingOption>('wallet');
  const [sourceMode, setSourceMode] = useState<SavingsSourceMode>('manual');
  const debouncedSearch = useDebounce(searchValue, 250);
  const { products, isLoading: isProductsLoading } = useProducts({
    limit: 8,
    search: debouncedSearch.trim() ? debouncedSearch.trim() : undefined,
  });
  const normalizedProductId = readParam(params.productId);
  const normalizedVariantId = readParam(params.variantId);
  const activeMerchantId = pickMerchantId(merchantId, CONFIG.MERCHANT_ID);
  const activeMerchantSlug = CONFIG.MERCHANT_SLUG?.trim() || undefined;
  const {
    isLoadingPaymentMethods,
    paymentMethodsError,
    savedPaymentMethods,
    selectedPaymentMethodId,
    setPaymentMethodsError,
    setSelectedPaymentMethodId,
  } = useStartSavingsPaymentMethods({
    activeMerchantId: activeMerchantId ?? undefined,
    activeMerchantSlug,
    sourceMode,
  });
  const safeWalletBalance =
    walletData?.wallet.earnings_balance ?? walletData?.wallet.balance ?? 0;
  const fundingAccount = walletData?.wallet.funding_account ?? null;

  const selectProduct = (product: Product) =>
    applyStartSavingsProductSelection({
      previousSelectedProduct: selectedProduct,
      product,
      setFormError,
      setSearchValue,
      setSelectedProduct,
      setTargetAmount,
      variantId: normalizedVariantId,
    });

  useEffect(() => {
    if (!normalizedProductId || selectedProduct) {
      return;
    }
    const preselected = products.find(
      (product) => product.id === normalizedProductId
    );
    if (!preselected) {
      return;
    }
    applyStartSavingsProductSelection({
      product: preselected,
      setFormError,
      setSearchValue,
      setSelectedProduct,
      setTargetAmount,
      variantId: normalizedVariantId,
    });
  }, [normalizedProductId, normalizedVariantId, products, selectedProduct]);

  const contributionValue = parseAmount(contributionAmount);
  const targetValue = parseAmount(targetAmount);
  const initialContributionValue = parseAmount(initialContributionAmount);
  const maturityDate =
    calculateMaturityDate({
      contributionAmount: contributionValue,
      frequency,
      startDate,
      targetAmount: targetValue,
    }) ?? '';
  const effectiveInitialContribution = getEffectiveInitialContribution({
    contributionAmount: contributionValue,
    fundingOption: selectedFundingOption,
    initialContributionAmount: initialContributionValue,
    initialContributionEnabled,
  });
  const requiredTopUpAmount = getRequiredTopUp({
    earningsBalance: safeWalletBalance,
    requiredContribution: effectiveInitialContribution,
  });
  const {
    goToWallet,
    handleAuthorizeSavingsCard,
    handleCopyFundingAccount,
    isAuthorizingCard,
    isSubmitting,
    openWalletFundingScreen,
    submitSavingsGoal,
  } = useStartSavingsSubmit({
    activeMerchantId: activeMerchantId ?? undefined,
    activeMerchantSlug,
    contributionValue,
    effectiveInitialContribution,
    frequency,
    fundingAccount,
    initialContributionIdempotencyKey,
    maturityDate,
    normalizedVariantId,
    refetch,
    requiredTopUpAmount,
    selectedPaymentMethodId,
    selectedProduct,
    setFormError,
    setInitialContributionIdempotencyKey,
    setShowFundingModal,
    setShowPreviewModal,
    setShowSuccessModal,
    setShowTransferModal,
    sourceMode,
    startDate,
    targetValue,
  });

  const handleContinue = () => {
    const error = validateStartSavingsForm({
      acceptsNonWithdrawableTerms,
      contributionValue,
      initialContributionEnabled,
      initialContributionValue,
      paymentProvider: 'paystack',
      selectedProduct,
      sourceMode,
      targetValue,
    });
    setFormError(error);
    if (!error) {
      setShowPreviewModal(true);
    }
  };

  const handleFundingContinue = async () => {
    if (sourceMode === 'auto_debit') {
      if (!selectedPaymentMethodId) {
        setPaymentMethodsError(
          'Select a saved card or authorize a new Paystack card.'
        );
        return;
      }
      await submitSavingsGoal();
      return;
    }

    if (selectedFundingOption === 'bank_transfer') {
      setShowFundingModal(false);
      setShowTransferModal(true);
      return;
    }

    await submitSavingsGoal();
  };

  const handleSourceModeChange = (nextMode: SavingsSourceMode) => {
    setSourceMode(nextMode);
    setFormError(null);
    setPaymentMethodsError(null);
    if (nextMode === 'auto_debit') {
      setInitialContributionEnabled(false);
      setInitialContributionAmount('');
    }
  };

  return {
    acceptsNonWithdrawableTerms,
    contributionAmount,
    contributionValue,
    debouncedSearch,
    effectiveInitialContribution,
    formError,
    frequency,
    fundingAccount,
    goToWallet,
    handleAuthorizeSavingsCard,
    handleContinue,
    handleCopyFundingAccount,
    handleFundingContinue,
    handleSourceModeChange,
    initialContributionAmount,
    initialContributionEnabled,
    isAuthorizingCard,
    isLoadingPaymentMethods,
    isProductsLoading,
    isRefetching,
    isSubmitting,
    maturityDate,
    openWalletFundingScreen,
    paymentMethodsError,
    preferredDebitTime,
    products,
    refetch,
    requiredTopUpAmount,
    safeWalletBalance,
    savedPaymentMethods,
    searchValue,
    selectProduct,
    selectedFundingOption,
    selectedPaymentMethodId,
    selectedProduct,
    setAcceptsNonWithdrawableTerms,
    setContributionAmount: (value: string) => {
      setFormError(null);
      setContributionAmount(normalizeAmountInput(value));
    },
    setFrequency,
    setInitialContributionAmount: (value: string) =>
      setInitialContributionAmount(normalizeAmountInput(value)),
    setInitialContributionEnabled,
    setPaymentMethodsError,
    setPreferredDebitTime,
    setSearchValue,
    setSelectedFundingOption,
    setSelectedPaymentMethodId,
    setShowFundingModal,
    setShowPreviewModal,
    setStartDate: (value: string) => setStartDate(formatDateInput(value)),
    setTargetAmount: (value: string) => {
      setFormError(null);
      setTargetAmount(normalizeAmountInput(value));
    },
    showFundingModal,
    showPreviewModal,
    showSuccessModal,
    showTransferModal,
    sourceMode,
    startDate,
    submitSavingsGoal,
    targetAmount,
    targetValue,
  };
}
