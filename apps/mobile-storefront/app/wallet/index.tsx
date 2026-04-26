import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import { WalletContent } from '@/components/wallet/WalletContent';
import { styles } from '@/components/wallet/wallet-screen.styles';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import { useRedeemPoints, useWallet } from '@/hooks/use-wallet';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { createLogger } from '@/lib/logger';
import { trackError, trackEvent } from '@/services/analytics';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('Wallet');

export default function WalletScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { getScrollContentStyle } = useStorefrontInsets();

  const { isLoading: authLoading, redirectTo } = useRequireAuth();
  const customer = useAuthStore((state) => state.customer);
  const { data, isLoading, refetch, isRefetching } = useWallet();
  const redeemMutation = useRedeemPoints();

  const [redeemPoints, setRedeemPoints] = useState('');
  const [showRedeemPanel, setShowRedeemPanel] = useState(false);

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
    paddingBottom: SPACING.xl,
  });

  const renderLoadingState = (message?: string) => (
    <>
      <Stack.Screen options={{ title: 'Wallet' }} />
      <StorefrontScreenShell
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
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

  if (!customer) {
    return renderLoadingState('Preparing your wallet...');
  }

  if (isLoading) {
    return renderLoadingState();
  }

  const walletData = data?.wallet ?? { balance: 0, loyalty_points: 0 };
  const transactions = data?.transactions ?? [];

  return (
    <>
      <Stack.Screen options={{ title: 'Wallet & Loyalty' }} />
      <StorefrontScreenShell
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <WalletContent
          colors={colors}
          contentContainerStyle={scrollContentStyle}
          isRedeemPending={redeemMutation.isPending}
          isRefetching={isRefetching}
          loyaltyPoints={walletData.loyalty_points}
          onChangeRedeemPoints={setRedeemPoints}
          onConfirmRedeem={handleRedeemPoints}
          onOpenRedeemPanel={() => setShowRedeemPanel(true)}
          onRefresh={refetch}
          onResetRedeem={() => {
            setShowRedeemPanel(false);
            setRedeemPoints('');
          }}
          redeemPoints={redeemPoints}
          showRedeemPanel={showRedeemPanel}
          transactions={transactions}
          walletBalance={walletData.balance}
        />
      </StorefrontScreenShell>
    </>
  );
}
