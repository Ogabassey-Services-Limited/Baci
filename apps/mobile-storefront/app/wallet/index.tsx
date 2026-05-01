import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import { WALLET_TAB_SCROLL_PADDING_BOTTOM } from '@/components/wallet/wallet-tab.constants';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import { useRedeemPoints, useWallet } from '@/hooks/use-wallet';
import { CONFIG } from '@/lib/config';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { createLogger } from '@/lib/logger';
import { initializeWalletTopUp } from '@/lib/wallet-top-up';
import {
  WALLET_TOP_UP_MAX_AMOUNT,
  WALLET_TOP_UP_MIN_AMOUNT,
} from '@/lib/wallet-top-up-constants';
import { trackError, trackEvent } from '@/services/analytics';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';
import { WalletContent } from './WalletContent';
import { styles } from './wallet.styles';

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
  const { action } = useLocalSearchParams<{ action?: string }>();
  const initialAction = Array.isArray(action) ? action[0] : action;

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

  const [redeemPoints, setRedeemPoints] = useState('');
  const [showRedeemPanel, setShowRedeemPanel] = useState(
    initialAction === 'redeem'
  );
  const [fundAmount, setFundAmount] = useState('');
  const [showFundPanel, setShowFundPanel] = useState(initialAction === 'fund');
  const [isFundPending, setIsFundPending] = useState(false);
  const activeMerchantId = merchantId || CONFIG.MERCHANT_ID;

  const handleFundAmountChange = (value: string) => {
    setFundAmount(value.replace(/\D/g, ''));
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
      });

      trackEvent('wallet_top_up_started', {
        amount,
        customer_id: customer?.id,
        gateway: result.gateway,
        merchant_id: activeMerchantId,
      });

      resetFundPanel();
      router.push({
        pathname: '/payment-gateway',
        params: {
          amount: String(amount),
          authorizationUrl: result.authorization_url,
          gateway: result.gateway,
          paymentKind: 'wallet',
          reference: result.reference,
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
    const points = Number.parseInt(redeemPoints, 10);

    if (Number.isNaN(points) || points <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of points');
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

  if (!user || !activeMerchantId) {
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

  return (
    <>
      {presentation === 'stack' ? (
        <Stack.Screen options={{ title: 'Wallet & Loyalty' }} />
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
          fundAmount={fundAmount}
          isFundPending={isFundPending}
          isRedeemPending={redeemMutation.isPending}
          isRefetching={isRefetching}
          loyaltyPoints={walletData.loyalty_points}
          onChangeFundAmount={handleFundAmountChange}
          onChangeRedeemPoints={setRedeemPoints}
          onConfirmFund={handleFundWallet}
          onConfirmRedeem={handleRedeemPoints}
          onOpenFundPanel={() => setShowFundPanel(true)}
          onOpenRedeemPanel={() => setShowRedeemPanel(true)}
          onRefresh={refetch}
          onResetFund={resetFundPanel}
          onResetRedeem={() => {
            setShowRedeemPanel(false);
            setRedeemPoints('');
          }}
          redeemPoints={redeemPoints}
          showFundPanel={showFundPanel}
          showRedeemPanel={showRedeemPanel}
          transactions={transactions}
          walletBalance={walletData.balance}
        />
      </StorefrontScreenShell>
    </>
  );
}
