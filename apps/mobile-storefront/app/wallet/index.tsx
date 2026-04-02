/**
 * Wallet & Loyalty Screen
 * Refactored with 2025 Best Practices:
 * - React Query for caching & deduplication
 * - Optimistic updates for instant feedback
 * - Real-time sync via custom hook
 */

import { Ionicons } from '@expo/vector-icons';
import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useRedeemPoints, useWallet } from '@/hooks/use-wallet';
import { createLogger } from '@/lib/logger';
import { trackError, trackEvent } from '@/services/analytics';
import { scheduleLocalNotification } from '@/services/push-notifications';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('Wallet');

export default function WalletScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Auth gate: check Supabase user session (not customer record)
  const { isLoading: authLoading, redirectTo } = useRequireAuth();
  // Customer needed for analytics — may be null briefly after login
  const customer = useAuthStore((state) => state.customer);

  // React Query hooks - handles caching, deduplication, and realtime sync
  const { data, isLoading, refetch, isRefetching } = useWallet();
  const redeemMutation = useRedeemPoints();

  const [redeemPoints, setRedeemPoints] = useState('');
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  const handleRedeemPoints = async () => {
    const points = Number.parseInt(redeemPoints, 10);

    if (Number.isNaN(points) || points <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number of points');
      return;
    }

    try {
      const result = await redeemMutation.mutateAsync(points);

      // Track analytics
      trackEvent('loyalty_redeemed', {
        points_redeemed: points,
        wallet_credit: result.walletCredit,
        remaining_points: result.remainingPoints,
        conversion_rate: result.conversionRate,
        customer_id: customer?.id,
      });

      // Send local push notification
      await scheduleLocalNotification(
        'Points Redeemed! 🎁',
        `${points} points converted to ₦${result.walletCredit?.toLocaleString()} wallet credit.`,
        { type: 'loyalty_redemption', points },
        1
      );

      Alert.alert(
        'Points Redeemed!',
        `${points} points converted to ₦${result.walletCredit?.toLocaleString()} wallet credit.`,
        [{ text: 'OK', onPress: () => setShowRedeemModal(false) }]
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

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'gold':
        return '#F59E0B';
      case 'silver':
        return '#9CA3AF';
      case 'platinum':
        return '#6366F1';
      default:
        return '#CD7F32'; // Bronze
    }
  };

  // Auth loading — wait for store to initialize
  if (authLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Wallet' }} />
        <View
          style={[
            styles.container,
            styles.centered,
            { backgroundColor: colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      </>
    );
  }

  // Not authenticated — redirect to login (with returnTo)
  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  // Authenticated but customer record still loading/creating
  if (!customer) {
    return (
      <>
        <Stack.Screen options={{ title: 'Wallet' }} />
        <View
          style={[
            styles.container,
            styles.centered,
            { backgroundColor: colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={BRAND.primary} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            Preparing your wallet...
          </Text>
        </View>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Wallet' }} />
        <View
          style={[
            styles.container,
            styles.centered,
            { backgroundColor: colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      </>
    );
  }

  const walletData = data?.wallet;
  const transactions = data?.transactions || [];

  return (
    <>
      <Stack.Screen options={{ title: 'Wallet & Loyalty' }} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => refetch()}
              tintColor={BRAND.primary}
            />
          }
        >
          {/* Wallet Balance Card */}
          <Animated.View
            entering={FadeIn.duration(400)}
            style={[styles.balanceCard, { backgroundColor: BRAND.primary }]}
          >
            <Text style={styles.balanceLabel}>Wallet Balance</Text>
            <Text style={styles.balanceAmount}>
              {formatPrice(walletData?.balance ?? 0)}
            </Text>
            <View style={styles.balanceActions}>
              <Pressable style={styles.balanceAction}>
                <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                <Text style={styles.balanceActionText}>Add Funds</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable style={styles.balanceAction}>
                <Ionicons
                  name="arrow-up-circle-outline"
                  size={20}
                  color="#FFF"
                />
                <Text style={styles.balanceActionText}>Withdraw</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Loyalty Points Card */}
          <Animated.View
            entering={FadeIn.duration(400).delay(100)}
            style={[
              styles.loyaltyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.loyaltyHeader}>
              <View>
                <Text
                  style={[styles.loyaltyLabel, { color: colors.textSecondary }]}
                >
                  Loyalty Points
                </Text>
                <Text style={[styles.loyaltyPoints, { color: colors.text }]}>
                  {(walletData?.loyalty_points ?? 0).toLocaleString()} pts
                </Text>
              </View>
              <View
                style={[
                  styles.tierBadge,
                  {
                    backgroundColor: getTierColor('Bronze'),
                  },
                ]}
              >
                <Ionicons name="star" size={14} color="#FFF" />
                <Text style={styles.tierText}>Bronze</Text>
              </View>
            </View>

            <View
              style={[styles.redeemSection, { borderTopColor: colors.border }]}
            >
              <Text
                style={[styles.redeemInfo, { color: colors.textSecondary }]}
              >
                100 points = ₦100 wallet credit
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.redeemBtn,
                  {
                    backgroundColor: BRAND.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => setShowRedeemModal(true)}
                disabled={(walletData?.loyalty_points ?? 0) < 100}
              >
                <Ionicons name="gift-outline" size={18} color="#FFF" />
                <Text style={styles.redeemBtnText}>Redeem Points</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Redeem Modal */}
          {showRedeemModal && (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={[
                styles.redeemModal,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.redeemModalTitle, { color: colors.text }]}>
                Redeem Loyalty Points
              </Text>
              <Text
                style={[
                  styles.redeemModalSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                Available: {(walletData?.loyalty_points ?? 0).toLocaleString()}{' '}
                points
              </Text>

              <TextInput
                style={[
                  styles.redeemInput,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={redeemPoints}
                onChangeText={setRedeemPoints}
                keyboardType="number-pad"
                placeholder="Enter points to redeem (min 100)"
                placeholderTextColor={colors.placeholder}
              />

              <View style={styles.redeemModalActions}>
                <Pressable
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowRedeemModal(false);
                    setRedeemPoints('');
                  }}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: BRAND.primary },
                  ]}
                  onPress={handleRedeemPoints}
                  disabled={redeemMutation.isPending}
                >
                  {redeemMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.confirmBtnText}>Redeem</Text>
                  )}
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* Transaction History */}
          <Animated.View
            entering={FadeIn.duration(400).delay(200)}
            style={[styles.historySection, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Recent Transactions
            </Text>

            {transactions.length === 0 ? (
              <View style={styles.emptyTransactions}>
                <Ionicons
                  name="receipt-outline"
                  size={40}
                  color={colors.textSecondary}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  No transactions yet
                </Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <View
                  key={tx.id}
                  style={[
                    styles.transactionItem,
                    { borderBottomColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.txIcon,
                      {
                        backgroundColor:
                          tx.type === 'credit' ? '#10B98120' : '#EF444420',
                      },
                    ]}
                  >
                    <Ionicons
                      name={tx.type === 'credit' ? 'arrow-down' : 'arrow-up'}
                      size={18}
                      color={tx.type === 'credit' ? '#10B981' : '#EF4444'}
                    />
                  </View>
                  <View style={styles.txDetails}>
                    <Text
                      style={[styles.txDescription, { color: colors.text }]}
                    >
                      {tx.description}
                    </Text>
                    <Text
                      style={[styles.txDate, { color: colors.textSecondary }]}
                    >
                      {formatDate(tx.created_at)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: tx.type === 'credit' ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {tx.type === 'credit' ? '+' : '-'}
                    {formatPrice(tx.amount)}
                  </Text>
                </View>
              ))
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
  },
  balanceCard: {
    margin: 16,
    borderRadius: 20,
    padding: 24,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  balanceAmount: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 8,
  },
  balanceActions: {
    flexDirection: 'row',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  balanceAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  balanceActionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  loyaltyCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  loyaltyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  loyaltyLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  loyaltyPoints: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tierText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  redeemSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  redeemInfo: {
    fontSize: 13,
    flex: 1,
  },
  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  redeemBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  redeemModal: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  redeemModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  redeemModalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  redeemInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  redeemModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  historySection: {
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyTransactions: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  txDetails: {
    flex: 1,
    marginLeft: 12,
  },
  txDescription: {
    fontSize: 14,
    fontWeight: '500',
  },
  txDate: {
    fontSize: 12,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
});
