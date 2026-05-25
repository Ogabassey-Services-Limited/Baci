import { VTU_MIN_REDEEMABLE_POINTS } from '@baci/shared/lib';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import { WalletContent } from '@/components/wallet/WalletContent';
import { styles } from '@/components/wallet/wallet.styles';
import { WALLET_TAB_SCROLL_PADDING_BOTTOM } from '@/components/wallet/wallet-tab.constants';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
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
import { pickMerchantId } from '@/lib/pick-merchant-id';
import { sanitizeWalletReturnTo } from '@/lib/sanitize-wallet-return-to';
import { initializeWalletTopUp } from '@/lib/wallet-top-up';
import {
  WALLET_TOP_UP_MAX_AMOUNT,
  WALLET_TOP_UP_MIN_AMOUNT,
} from '@/lib/wallet-top-up-constants';
import { trackError, trackEvent } from '@/services/analytics';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('Wallet');
const warnedWalletBalanceWarnings = new Set<string>();

type WalletBalanceField =
  | 'earnings_balance'
  | 'savings_balance'
  | 'total_balance';
type WalletBalanceWarningKey = WalletBalanceField | 'total_balance_mismatch';

interface WalletScreenProps {
  presentation?: 'stack' | 'tab';
}

function logWalletBalanceContractWarning({
  computedTotalBalance,
  earningsBalance,
  merchantId,
  ownerId,
  savingsBalance,
  totalBalance,
  walletData,
}: {
  computedTotalBalance: number;
  earningsBalance: number;
  merchantId: string;
  ownerId: string;
  savingsBalance: number;
  totalBalance: number;
  walletData: {
    earnings_balance?: number;
    savings_balance?: number;
    total_balance?: number;
  };
}) {
  const fallbackValues: Record<WalletBalanceField, number> = {
    earnings_balance: earningsBalance,
    savings_balance: savingsBalance,
    total_balance: totalBalance,
  };
  const missingFields = (
    ['earnings_balance', 'savings_balance', 'total_balance'] as const
  ).filter((field) => walletData[field] == null);
  const hasTotalMismatch =
    walletData.total_balance != null &&
    walletData.total_balance !== computedTotalBalance;
  const warningScope = `${merchantId || 'unknown-merchant'}:${ownerId || 'unknown-owner'}`;
  const getDedupeKey = (warningKey: WalletBalanceWarningKey) =>
    `${warningScope}:${warningKey}`;
  const newMissingFields = missingFields.filter(
    (field) => !warnedWalletBalanceWarnings.has(getDedupeKey(field))
  );
  const shouldWarnTotalMismatch =
    hasTotalMismatch &&
    !warnedWalletBalanceWarnings.has(getDedupeKey('total_balance_mismatch'));

  if (newMissingFields.length === 0 && !shouldWarnTotalMismatch) {
    return;
  }

  for (const field of newMissingFields) {
    warnedWalletBalanceWarnings.add(getDedupeKey(field));
  }
  if (shouldWarnTotalMismatch) {
    warnedWalletBalanceWarnings.add(getDedupeKey('total_balance_mismatch'));
  }

  log.warn('Wallet API balance contract warning; using safe display values.', {
    computedTotalBalance,
    fallbackValues: Object.fromEntries(
      newMissingFields.map((field) => [field, fallbackValues[field]])
    ),
    mismatchedFields: shouldWarnTotalMismatch ? ['total_balance'] : [],
    missingFields: newMissingFields,
    merchantId,
    ownerId,
    serverTotalBalance: walletData.total_balance,
  });
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
  const routeRequiredAmount = normalizeFundAmountParam(requiredAmount);
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
  const activeMerchantId = pickMerchantId(merchantId, CONFIG.MERCHANT_ID);
  const activeMerchantSlug = CONFIG.MERCHANT_SLUG?.trim() || undefined;
  const hasMerchantContext = Boolean(activeMerchantId || activeMerchantSlug);
  const warningWalletData = data?.wallet;
  const warningOwnerId = customer?.id ?? user?.id ?? '';
  const warningEarningsBalance = warningWalletData
    ? (warningWalletData.earnings_balance ?? warningWalletData.balance ?? 0)
    : 0;
  const warningSavingsBalance = warningWalletData?.savings_balance ?? 0;
  const warningComputedTotalBalance =
    warningEarningsBalance + warningSavingsBalance;
  const warningTotalBalance =
    warningWalletData?.total_balance ?? warningComputedTotalBalance;

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

  useEffect(() => {
    if (!warningWalletData || !warningOwnerId || !activeMerchantId) {
      return;
    }

    logWalletBalanceContractWarning({
      computedTotalBalance: warningComputedTotalBalance,
      earningsBalance: warningEarningsBalance,
      merchantId: activeMerchantId,
      ownerId: warningOwnerId,
      savingsBalance: warningSavingsBalance,
      totalBalance: warningTotalBalance,
      walletData: warningWalletData,
    });
  }, [
    activeMerchantId,
    warningComputedTotalBalance,
    warningEarningsBalance,
    warningOwnerId,
    warningSavingsBalance,
    warningTotalBalance,
    warningWalletData,
  ]);

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

  const renderLoadingState = (message?: string) => (
    <>
      {presentation === 'stack' ? (
        <Stack.Screen options={{ title: 'Wallet' }} />
      ) : null}
      <StorefrontScreenShell
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={presentation === 'tab' ? ['top'] : ['bottom']}
      >
        {presentation === 'tab' ? (
          <View style={styles.tabHeader}>
            <Text style={[styles.tabHeaderTitle, { color: colors.text }]}>
              Wallet & Loyalty
            </Text>
          </View>
        ) : null}
        <View style={[styles.container, styles.centered]}>
          <ActivityIndicator
            testID="wallet-activity-indicator"
            accessibilityLabel="Preparing wallet"
            size="large"
            color={BRAND.primary}
          />
          {message ? (
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              {message}
            </Text>
          ) : null}
        </View>
      </StorefrontScreenShell>
    </>
  );

  if (authLoading) {
    return renderLoadingState();
  }

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  if (!user || !hasMerchantContext) {
    return renderLoadingState('Preparing your wallet...');
  }

  if (isLoading) {
    return renderLoadingState();
  }

  if (isError && !data) {
    return renderLoadingState('Unable to load wallet.');
  }

  if (!data) {
    return renderLoadingState('Preparing your wallet...');
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
    <>
      {presentation === 'stack' ? (
        <Stack.Screen options={{ title: 'Wallet' }} />
      ) : null}
      <StorefrontScreenShell
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={presentation === 'tab' ? ['top'] : ['bottom']}
      >
        {presentation === 'tab' ? (
          <View style={styles.tabHeader}>
            <Text style={[styles.tabHeaderTitle, { color: colors.text }]}>
              Wallet & Loyalty
            </Text>
          </View>
        ) : null}
        <WalletContent
          colors={colors}
          contentContainerStyle={scrollContentStyle}
          earningsBalance={earningsBalance}
          fundAmount={fundAmount}
          fundingAccount={fundingAccount}
          isCreatingFundingAccount={createFundingAccountMutation.isPending}
          isFundPending={isFundPending}
          isRedeemPending={redeemMutation.isPending}
          isRefetching={isRefetching}
          loyaltyPoints={walletData.loyalty_points}
          onChangeFundAmount={handleFundAmountChange}
          onCreateFundingAccount={handleCreateFundingAccount}
          onChangeRedeemPoints={setRedeemPoints}
          onConfirmFund={handleFundWallet}
          onConfirmRedeem={handleRedeemPoints}
          onManageCards={() => router.push('/wallet/manage-cards')}
          onOpenFundPanel={() => setShowFundPanel(true)}
          onOpenRedeemPanel={() => setShowRedeemPanel(true)}
          onQuickSave={() => router.push('/wallet/savings/start')}
          onRefresh={refetch}
          onResetFund={resetFundPanel}
          onResetRedeem={() => {
            setShowRedeemPanel(false);
            setRedeemPoints('');
          }}
          onStartSavings={() => router.push('/wallet/savings/start')}
          redeemPoints={redeemPoints}
          savingsBalance={savingsBalance}
          showQuickSave={showQuickSave}
          showFundPanel={showFundPanel}
          showRedeemPanel={showRedeemPanel}
          totalBalance={totalBalance}
          transactions={transactions}
        />
      </StorefrontScreenShell>
    </>
  );
}

function normalizeFundAmountParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const amount = Number(rawValue);
  if (!Number.isFinite(amount) || amount <= 0) {
    return '';
  }
  // Wallet top-ups use whole naira amounts, so fractional required amounts round up.
  return String(Math.ceil(amount));
}
