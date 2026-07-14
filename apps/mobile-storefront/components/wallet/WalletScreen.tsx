import * as Crypto from 'expo-crypto';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useColorScheme } from '@/components/useColorScheme';
import { useWalletBalanceContractWarning } from '@/components/wallet/use-wallet-balance-contract-warning';
import { useWalletFundingAccountController } from '@/components/wallet/use-wallet-funding-account-controller';
import { useWalletRouteActionSetup } from '@/components/wallet/use-wallet-route-action-setup';
import { WalletScreenView } from '@/components/wallet/WalletScreenView';
import { WALLET_TAB_SCROLL_PADDING_BOTTOM } from '@/components/wallet/wallet-tab.constants';
import Colors, { SPACING } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import {
  useCreateWalletFundingAccount,
  useRedeemPoints,
  useWallet,
} from '@/hooks/use-wallet';
import { useMerchantPaymentSettings } from '@/hooks/useMerchantPaymentSettings';
import { CONFIG } from '@/lib/config';
import { addSavingsContribution } from '@/lib/customer-savings';
import { normalizeWalletFundAmountParam } from '@/lib/normalize-wallet-fund-amount-param';
import { pickMerchantId } from '@/lib/pick-merchant-id';
import { sanitizeWalletReturnTo } from '@/lib/sanitize-wallet-return-to';
import { cancelSavingsReminderNotification } from '@/services/savings-reminder-notifications';
import { useAuthStore } from '@/stores/auth-store';
import { fundWallet, redeemWalletPoints } from './wallet-screen.handlers';
import {
  deriveWalletDisplayData,
  getWalletLoadingMessage,
  sanitizeWalletFundAmount,
} from './wallet-screen.helpers';
import {
  addSavingsContributionToGoal,
  changeSavingsGoalDevice,
} from './wallet-screen-savings.handlers';

interface WalletScreenProps {
  action?: string | string[];
  presentation?: 'stack' | 'tab';
  requiredAmount?: string | string[];
  returnTo?: string | string[];
}
export function WalletScreen({
  action,
  presentation = 'stack',
  requiredAmount,
  returnTo,
}: WalletScreenProps = {}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { getScrollContentStyle } = useStorefrontInsets();
  const routeAction = Array.isArray(action) ? action[0] : action;
  const routeRequiredAmount = normalizeWalletFundAmountParam(requiredAmount);
  const walletReturnTo = sanitizeWalletReturnTo(returnTo);
  const { isLoading: authLoading, redirectTo } = useRequireAuth();
  const { customer, merchantId, updateProfile, user } = useAuthStore(
    useShallow((state) => ({
      customer: state.customer,
      merchantId: state.merchantId,
      updateProfile: state.updateProfile,
      user: state.user,
    }))
  );
  const { data, isError, isLoading, refetch, isRefetching } = useWallet({
    cachePolicy: 'display',
  });
  const {
    data: paymentSettings,
    isError: isPaymentSettingsError,
    isPending: isPaymentSettingsQueryPending,
  } = useMerchantPaymentSettings();
  const redeemMutation = useRedeemPoints();
  const createFundingAccountMutation = useCreateWalletFundingAccount();
  const [redeemPoints, setRedeemPoints] = useState('');
  const [showRedeemPanel, setShowRedeemPanel] = useState(
    routeAction === 'redeem'
  );
  const [fundAmount, setFundAmount] = useState(routeRequiredAmount);
  const [showFundPanel, setShowFundPanel] = useState(routeAction === 'fund');
  const [isFundPending, setIsFundPending] = useState(false);
  const [savingsContributionAmount, setSavingsContributionAmount] =
    useState('');
  const [showSavingsProgressModal, setShowSavingsProgressModal] = useState(
    routeAction === 'savings'
  );
  const [isAddingSavingsContribution, setIsAddingSavingsContribution] =
    useState(false);
  const [fundReturnTo, setFundReturnTo] = useState(walletReturnTo);
  const savingsContributionIdempotencyKeyRef = useRef<string | null>(null);
  const activeMerchantId =
    pickMerchantId(merchantId, CONFIG.MERCHANT_ID) ?? undefined;
  const activeMerchantSlug = CONFIG.MERCHANT_SLUG?.trim() || undefined;
  const hasMerchantContext = Boolean(activeMerchantId || activeMerchantSlug);
  const {
    canCreateFundingAccount,
    createFundingAccountUnavailableMessage,
    needsPhone,
    onCreateFundingAccount: handleCreateFundingAccount,
    onSubmitPhone: handleSubmitPhone,
  } = useWalletFundingAccountController({
    activeMerchantId,
    activeMerchantSlug,
    createFundingAccount: createFundingAccountMutation.mutateAsync,
    customerId: customer?.id,
    customerPhone: customer?.phone,
    isPaymentSettingsError,
    isPaymentSettingsPending: isPaymentSettingsQueryPending,
    paymentSettings,
    setShowFundPanel,
    updateProfile,
  });
  useWalletBalanceContractWarning({
    merchantId: activeMerchantId,
    ownerId: customer?.id ?? user?.id ?? '',
    walletData: data?.wallet,
  });
  const handleFundAmountChange = (value: string) =>
    setFundAmount(sanitizeWalletFundAmount(value));
  useWalletRouteActionSetup({
    bankTransfer: {
      canCreateFundingAccount,
      createFundingAccount: handleCreateFundingAccount,
      hasFundingAccount: Boolean(data?.wallet?.funding_account),
      hasWalletData: Boolean(data),
      isCreating: createFundingAccountMutation.isPending,
      needsPhone,
    },
    customerId: customer?.id,
    routeAction,
    routeRequiredAmount,
    setFundAmount,
    setFundReturnTo,
    setShowFundPanel,
    setShowRedeemPanel,
    setShowSavingsProgressModal,
    walletReturnTo,
  });
  const resetFundPanel = () => {
    setShowFundPanel(false);
    setFundAmount('');
    setFundReturnTo(walletReturnTo);
  };
  const resetRedeemPanel = () => {
    setShowRedeemPanel(false);
    setRedeemPoints('');
  };
  const handleFundWallet = () =>
    fundWallet({
      activeMerchantId,
      activeMerchantSlug,
      customer,
      fundAmount,
      resetFundPanel,
      setIsFundPending,
      user,
      walletReturnTo: fundReturnTo,
    });
  const handleRedeemPoints = () =>
    redeemWalletPoints({
      clearRedeemPoints: () => setRedeemPoints(''),
      closeRedeemPanel: () => setShowRedeemPanel(false),
      customerId: customer?.id,
      rawPoints: redeemPoints,
      redeemPoints: redeemMutation.mutateAsync,
    });
  const scrollContentStyle = getScrollContentStyle({
    includeBottomInset: presentation === 'tab',
    paddingBottom:
      presentation === 'tab' ? WALLET_TAB_SCROLL_PADDING_BOTTOM : SPACING.xl,
  });
  if (authLoading) {
    return <WalletScreenView colors={colors} presentation={presentation} />;
  }
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }
  const loadingMessage = getWalletLoadingMessage({
    hasMerchantContext,
    hasWalletData: Boolean(data),
    isError,
    isLoading,
    user,
  });
  if (!user || !hasMerchantContext || isLoading || !data) {
    return (
      <WalletScreenView
        colors={colors}
        loadingMessage={loadingMessage}
        presentation={presentation}
      />
    );
  }
  const { wallet: walletData, transactions } = data;
  const {
    activeSavingsGoal,
    earningsBalance,
    fundingAccount,
    savingsBalance,
    showQuickSave,
    totalBalance,
  } = deriveWalletDisplayData(walletData);
  const handleOpenSavings = () => {
    if (activeSavingsGoal && activeSavingsGoal.status !== 'completed') {
      setShowSavingsProgressModal(true);
      return;
    }
    router.push('/wallet/savings/start');
  };
  const handleFundSavingsWallet = () => {
    setShowSavingsProgressModal(false);
    setShowFundPanel(true);
    setFundReturnTo('/wallet?action=savings');
    if (savingsContributionAmount) {
      setFundAmount(savingsContributionAmount);
    }
  };
  const handleAddSavingsContribution = () =>
    addSavingsContributionToGoal({
      activeMerchantId,
      activeMerchantSlug,
      addSavingsContribution,
      clearSavingsContributionAmount: () => setSavingsContributionAmount(''),
      clearIdempotencyKey: () =>
        (savingsContributionIdempotencyKeyRef.current = null),
      // `=` with `??` instead of `??=` (React Compiler BuildHIR todo).
      createIdempotencyKey: () =>
        (savingsContributionIdempotencyKeyRef.current =
          savingsContributionIdempotencyKeyRef.current ?? Crypto.randomUUID()),
      cancelSavingsReminder: cancelSavingsReminderNotification,
      goal: activeSavingsGoal,
      rawAmount: savingsContributionAmount,
      refetchWallet: refetch,
      setIsAddingSavingsContribution,
    });
  return (
    <WalletScreenView
      colors={colors}
      presentation={presentation}
      walletContentProps={{
        activeSavingsGoal,
        canCreateFundingAccount,
        contentContainerStyle: scrollContentStyle,
        createFundingAccountUnavailableMessage,
        customerId: customer?.id,
        earningsBalance,
        fundAmount,
        fundReturnTo,
        fundingAccount,
        isAddingSavingsContribution,
        isCreatingFundingAccount: createFundingAccountMutation.isPending,
        isFundPending,
        isRedeemPending: redeemMutation.isPending,
        isRefetching,
        loyaltyPoints: walletData.loyalty_points,
        needsPhone,
        onAddSavingsContribution: handleAddSavingsContribution,
        onChangeSavingsDevice: (product, variantId) =>
          changeSavingsGoalDevice({
            activeMerchantId,
            activeMerchantSlug,
            goal: activeSavingsGoal,
            product,
            refetchWallet: refetch,
            variantId,
          }),
        onChangeSavingsContributionAmount: (value) =>
          setSavingsContributionAmount(sanitizeWalletFundAmount(value)),
        onChangeFundAmount: handleFundAmountChange,
        onCreateFundingAccount: handleCreateFundingAccount,
        onChangeRedeemPoints: setRedeemPoints,
        onCloseSavingsProgress: () => setShowSavingsProgressModal(false),
        onConfirmFund: handleFundWallet,
        onConfirmRedeem: handleRedeemPoints,
        onFundSavingsWallet: handleFundSavingsWallet,
        onManageCards: () => router.push('/wallet/manage-cards'),
        onOpenFundPanel: () => setShowFundPanel(true),
        onOpenRedeemPanel: () => setShowRedeemPanel(true),
        onQuickSave: handleOpenSavings,
        onRefresh: refetch,
        onResetFund: resetFundPanel,
        onResetRedeem: resetRedeemPanel,
        onStartSavings: handleOpenSavings,
        onSubmitPhone: handleSubmitPhone,
        redeemPoints,
        savingsContributionAmount,
        savingsBalance,
        showSavingsProgress: showSavingsProgressModal,
        showQuickSave,
        showFundPanel,
        showRedeemPanel,
        totalBalance,
        transactions,
      }}
    />
  );
}
