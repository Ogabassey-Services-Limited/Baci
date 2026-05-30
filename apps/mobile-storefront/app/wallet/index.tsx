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
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { createLogger } from '@/lib/logger';
import { normalizeWalletFundAmountParam } from '@/lib/normalize-wallet-fund-amount-param';
import { pickMerchantId } from '@/lib/pick-merchant-id';
import { sanitizeWalletReturnTo } from '@/lib/sanitize-wallet-return-to';
import { initializeWalletTopUp } from '@/lib/wallet-top-up';
import { WALLET_TOP_UP_MAX_AMOUNT, WALLET_TOP_UP_MIN_AMOUNT } from '@/lib/wallet-top-up-constants';
import { trackError, trackEvent } from '@/services/analytics';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('Wallet');

interface WalletScreenProps {
  presentation?: 'stack' | 'tab';
}

export default function WalletScreen({
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
  const [showRedeemPanel, setShowRedeemPanel] = useState(routeAction === 'redeem');
  const [fundAmount, setFundAmount] = useState(routeRequiredAmount);
  const [showFundPanel, setShowFundPanel] = useState(routeAction === 'fund');
  const [isFundPending, setIsFundPending] = useState(false);
  const activeMerchantId = pickMerchantId(merchantId, CONFIG.MERCHANT_ID);
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

  const handleFundAmountChange = (value: string) => {
    setFundAmount(value.replace(/\D/g, ''));
  };

  const handleCreateFundingAccount = async () => {
    try {
      const result = await createFundingAccountMutation.mutateAsync();
      if (result.account) {
        Alert.alert(
          'Account Ready',
          `${result.account.bankName} - ${result.account.accountNumber}`
        );
      }
    } catch (error) {
      trackError(
        'wallet_funding_account_create_failed',
        error instanceof Error ? error.message : 'Unknown error',
        {
          customer_id: customer?.id,
          merchant_id: activeMerchantId,
          merchant_slug: activeMerchantSlug,
        }
      );
      Alert.alert(
        'Unable to create account number',
        error instanceof Error ? error.message : 'Please try again in a moment.'
      );
    }
  };

  const resetFundPanel = () => {
    setShowFundPanel(false);
    setFundAmount('');
  };

  const handleFundWallet = async () => {
    const amount = Number(fundAmount);

    if (
      !Number.isFinite(amount) ||
      amount < WALLET_TOP_UP_MIN_AMOUNT ||
      amount > WALLET_TOP_UP_MAX_AMOUNT
    ) {
      Alert.alert(
        'Invalid Amount',
        `Wallet top-up amount must be between ₦${WALLET_TOP_UP_MIN_AMOUNT} and ₦${WALLET_TOP_UP_MAX_AMOUNT.toLocaleString()}.`
      );
      return;
    }
    setIsFundPending(true);
    try {
      const customerName =
        [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
        customer?.email ||
        user?.email ||
        'Customer';
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
        params: {
          amount: String(amount),
          authorizationUrl: result.authorization_url,
          gateway: result.gateway,
          ...(activeMerchantId ? { merchantId: activeMerchantId } : {}),
          ...(activeMerchantSlug ? { merchantSlug: activeMerchantSlug } : {}),
          paymentKind: 'wallet',
          reference: result.reference,
          ...(walletReturnTo ? { returnTo: walletReturnTo } : {}),
        },
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
    const trimmedRedeemPoints = redeemPoints.trim();
    if (!/^\d+$/.test(trimmedRedeemPoints)) {
      Alert.alert('Invalid Input', 'Please enter a valid number of points');
      return;
    }

    const points = Number(trimmedRedeemPoints);

    if (!Number.isSafeInteger(points) || points <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of points');
      return;
    }

    if (points < VTU_MIN_REDEEMABLE_POINTS) {
      Alert.alert('Invalid Points', 'Minimum redemption is 100 points');
      return;
    }

    if (points % VTU_MIN_REDEEMABLE_POINTS !== 0) {
      Alert.alert('Invalid Points', 'Redeem points in 100-point blocks');
      return;
    }

    try {
      const result = await redeemMutation.mutateAsync(points);
      const walletCreditMessage = formatNgnCurrency(result.walletCredit ?? 0);

      trackEvent('loyalty_redeemed', {
        points_redeemed: points,
        wallet_credit: result.walletCredit,
        remaining_points: result.remainingPoints,
        conversion_rate: result.conversionRate,
        customer_id: customer?.id,
      });

      await scheduleLocalNotification(
        'Points Redeemed! 🎁',
        `${points} points converted to ${walletCreditMessage} wallet credit.`,
        { type: 'loyalty_redemption', points },
        1
      );

      Alert.alert(
        'Points Redeemed!',
        `${points} points converted to ${walletCreditMessage} wallet credit.`,
        [{ text: 'OK', onPress: () => setShowRedeemPanel(false) }]
      );

      setRedeemPoints('');
    } catch (error) {
      log.error('Redemption error:', error);

      trackError(
        'loyalty_redemption_failed',
        error instanceof Error ? error.message : 'Unknown error',
        { points_attempted: points, customer_id: customer?.id }
      );

      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to redeem points. Please try again.'
      );
    }
  };

  const scrollContentStyle = getScrollContentStyle({
    includeBottomInset: false,
    paddingBottom:
      presentation === 'tab' ? WALLET_TAB_SCROLL_PADDING_BOTTOM : SPACING.xl,
  });

  if (authLoading) {
    return <WalletScreenView colors={colors} presentation={presentation} />;
  }

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  let loadingMessage: string | undefined;
  if (!user || !hasMerchantContext) {
    loadingMessage = 'Preparing your wallet...';
  } else if (!isLoading && isError && !data) {
    loadingMessage = 'Unable to load wallet.';
  } else if (!isLoading && !data) {
    loadingMessage = 'Preparing your wallet...';
  }

  if (!user || !hasMerchantContext || isLoading || !data) {
    return (
      <WalletScreenView
        colors={colors}
        loadingMessage={loadingMessage}
        presentation={presentation}
      />
    );
  }

  const walletData = data.wallet;
  const transactions = data.transactions;
  const earningsBalance =
    walletData.earnings_balance ?? walletData.balance ?? 0;
  const savingsBalance = walletData.savings_balance ?? 0;
  const computedTotalBalance = earningsBalance + savingsBalance;
  const totalBalance = walletData.total_balance ?? computedTotalBalance;
  const fundingAccount = walletData.funding_account
    ? {
        accountName: walletData.funding_account.account_name,
        accountNumber: walletData.funding_account.account_number,
        bankName: walletData.funding_account.bank_name,
        provider: walletData.funding_account.provider,
      }
    : null;
  const showQuickSave = savingsBalance > 0;

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
        onQuickSave: () => router.push('/wallet/savings/start'),
        onRefresh: refetch,
        onResetFund: resetFundPanel,
        onResetRedeem: () => {
          setShowRedeemPanel(false);
          setRedeemPoints('');
        },
        onStartSavings: () => router.push('/wallet/savings/start'),
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
