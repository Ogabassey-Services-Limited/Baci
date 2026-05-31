import { VTU_MIN_REDEEMABLE_POINTS } from '@baci/shared/lib';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useColorScheme } from '@/components/useColorScheme';
import { WalletScreenView } from '@/components/wallet/WalletScreenView';
import { useWalletBalanceContractWarning } from '@/components/wallet/use-wallet-balance-contract-warning';
import { WALLET_TAB_SCROLL_PADDING_BOTTOM } from '@/components/wallet/wallet-tab.constants';
import Colors, { SPACING } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import {
  useCreateWalletFundingAccount,
  useRedeemPoints,
  useWallet,
} from '@/hooks/use-wallet';
import { CONFIG } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import { normalizeWalletFundAmountParam } from '@/lib/normalize-wallet-fund-amount-param';
import { pickMerchantId } from '@/lib/pick-merchant-id';
import { sanitizeWalletReturnTo } from '@/lib/sanitize-wallet-return-to';
import { initializeWalletTopUp } from '@/lib/wallet-top-up';
import { trackError, trackEvent } from '@/services/analytics';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';
import {
  buildWalletTopUpGatewayParams,
  deriveWalletDisplayData,
  getWalletCustomerName,
  getWalletLoadingMessage,
  resolveCreateFundingAccountOutcome,
  resolveWalletRedeemPointsOutcome,
  sanitizeWalletFundAmount,
  validateWalletTopUpAmount,
} from './wallet-screen.helpers';

const log = createLogger('Wallet');

interface WalletScreenProps {
  presentation?: 'stack' | 'tab';
}

export function WalletScreen({
  presentation = 'stack',
}: WalletScreenProps = {}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { getScrollContentStyle } = useStorefrontInsets();
  const { action, requiredAmount, returnTo } = useLocalSearchParams<{
    action?: string;
    requiredAmount?: string;
    returnTo?: string;
  }>();
  const routeAction = Array.isArray(action) ? action[0] : action;
  const routeRequiredAmount = normalizeWalletFundAmountParam(requiredAmount);
  const walletReturnTo = sanitizeWalletReturnTo(returnTo);

  const { isLoading: authLoading, redirectTo } = useRequireAuth();
  const { customer, merchantId, user } = useAuthStore(
    useShallow((state) => ({
      customer: state.customer,
      merchantId: state.merchantId,
      user: state.user,
    }))
  );
  const { data, isError, isLoading, refetch, isRefetching } = useWallet();
  const redeemMutation = useRedeemPoints();
  const createFundingAccountMutation = useCreateWalletFundingAccount();

  const [redeemPoints, setRedeemPoints] = useState('');
  const [showRedeemPanel, setShowRedeemPanel] = useState(
    routeAction === 'redeem'
  );
  const [fundAmount, setFundAmount] = useState(routeRequiredAmount);
  const [showFundPanel, setShowFundPanel] = useState(routeAction === 'fund');
  const [isFundPending, setIsFundPending] = useState(false);
  const activeMerchantId =
    pickMerchantId(merchantId, CONFIG.MERCHANT_ID) ?? undefined;
  const activeMerchantSlug = CONFIG.MERCHANT_SLUG?.trim() || undefined;
  const hasMerchantContext = Boolean(activeMerchantId || activeMerchantSlug);
  useWalletBalanceContractWarning({
    merchantId: activeMerchantId,
    ownerId: customer?.id ?? user?.id ?? '',
    walletData: data?.wallet,
  });

  useEffect(() => {
    if (routeAction === 'fund') {
      setShowFundPanel(true);
      setShowRedeemPanel(false);
      setFundAmount(routeRequiredAmount);
      return;
    }

    if (routeAction === 'redeem') {
      setShowFundPanel(false);
      setShowRedeemPanel(true);
    }
  }, [routeAction, routeRequiredAmount]);

  const handleFundAmountChange = (value: string) =>
    setFundAmount(sanitizeWalletFundAmount(value));

  const handleCreateFundingAccount = async () => {
    const outcome = await resolveCreateFundingAccountOutcome(
      createFundingAccountMutation.mutateAsync
    );
    if (outcome.status === 'error') {
      trackError(
        'wallet_funding_account_create_failed',
        outcome.telemetryMessage,
        {
          customer_id: customer?.id,
          merchant_id: activeMerchantId,
          merchant_slug: activeMerchantSlug,
        }
      );
      Alert.alert('Unable to create account number', outcome.alertMessage);
      return;
    }

    if (outcome.accountSummary) {
      Alert.alert('Account Ready', outcome.accountSummary);
    }
  };

  const resetFundPanel = () => {
    setShowFundPanel(false);
    setFundAmount('');
  };

  const handleFundWallet = async () => {
    const amount = Number(fundAmount);
    const amountValidationError = validateWalletTopUpAmount(amount);
    if (amountValidationError) {
      Alert.alert('Invalid Amount', amountValidationError);
      return;
    }

    setIsFundPending(true);
    try {
      const customerName = getWalletCustomerName(customer, user);
      const result = await initializeWalletTopUp({
        amount,
        customerName,
        customerPhone: customer?.phone,
        merchantId: activeMerchantId,
        merchantSlug: activeMerchantSlug,
      });
      trackEvent('wallet_top_up_started', {
        amount,
        customer_id: customer?.id,
        gateway: result.gateway,
        merchant_id: activeMerchantId,
        merchant_slug: activeMerchantSlug,
      });
      resetFundPanel();
      router.push({
        pathname: '/payment-gateway',
        params: buildWalletTopUpGatewayParams({
          activeMerchantId,
          activeMerchantSlug,
          amount,
          result,
          walletReturnTo,
        }),
      });
    } catch (error) {
      log.error('Wallet top-up initialization error:', error);
      trackError(
        'wallet_top_up_failed',
        error instanceof Error ? error.message : 'Unknown error',
        { amount, customer_id: customer?.id }
      );
      Alert.alert(
        'Top-up Failed',
        error instanceof Error
          ? error.message
          : 'Failed to start wallet top-up. Please try again.'
      );
    } finally {
      setIsFundPending(false);
    }
  };

  const handleRedeemPoints = async () => {
    const outcome = await resolveWalletRedeemPointsOutcome({
      minimumRedeemablePoints: VTU_MIN_REDEEMABLE_POINTS,
      rawPoints: redeemPoints,
      redeemPoints: redeemMutation.mutateAsync,
    });
    if (outcome.status === 'invalid') {
      Alert.alert(outcome.title, outcome.message);
      return;
    }

    if (outcome.status === 'error') {
      log.error('Redemption error:', outcome.alertMessage);
      trackError('loyalty_redemption_failed', outcome.telemetryMessage, {
        points_attempted: outcome.points,
        customer_id: customer?.id,
      });
      Alert.alert('Error', outcome.alertMessage);
      return;
    }

    trackEvent('loyalty_redeemed', {
      points_redeemed: outcome.points,
      wallet_credit: outcome.result.walletCredit,
      remaining_points: outcome.result.remainingPoints,
      conversion_rate: outcome.result.conversionRate,
      customer_id: customer?.id,
    });

    await scheduleLocalNotification(
      'Points Redeemed! 🎁',
      outcome.successMessage,
      { type: 'loyalty_redemption', points: outcome.points },
      1
    );

    Alert.alert('Points Redeemed!', outcome.successMessage, [
      { text: 'OK', onPress: () => setShowRedeemPanel(false) },
    ]);

    setRedeemPoints('');
  };

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
    earningsBalance,
    fundingAccount,
    savingsBalance,
    showQuickSave,
    totalBalance,
  } = deriveWalletDisplayData(walletData);
  const handleOpenSavings = () => router.push('/wallet/savings/start');

  return (
    <WalletScreenView
      colors={colors}
      presentation={presentation}
      walletContentProps={{
        contentContainerStyle: scrollContentStyle,
        earningsBalance,
        fundAmount,
        fundingAccount,
        isCreatingFundingAccount: createFundingAccountMutation.isPending,
        isFundPending,
        isRedeemPending: redeemMutation.isPending,
        isRefetching,
        loyaltyPoints: walletData.loyalty_points,
        onChangeFundAmount: handleFundAmountChange,
        onCreateFundingAccount: handleCreateFundingAccount,
        onChangeRedeemPoints: setRedeemPoints,
        onConfirmFund: handleFundWallet,
        onConfirmRedeem: handleRedeemPoints,
        onManageCards: () => router.push('/wallet/manage-cards'),
        onOpenFundPanel: () => setShowFundPanel(true),
        onOpenRedeemPanel: () => setShowRedeemPanel(true),
        onQuickSave: handleOpenSavings,
        onRefresh: refetch,
        onResetFund: resetFundPanel,
        onResetRedeem: () => {
          setShowRedeemPanel(false);
          setRedeemPoints('');
        },
        onStartSavings: handleOpenSavings,
        redeemPoints,
        savingsBalance,
        showQuickSave,
        showFundPanel,
        showRedeemPanel,
        totalBalance,
        transactions,
      }}
    />
  );
}
