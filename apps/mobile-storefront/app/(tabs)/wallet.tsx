/**
 * Wallet Tab Screen
 * Quick access to wallet balance and rewards from tab bar
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, {
  BRAND,
  RADIUS,
  SHADOWS,
  SPACING,
  palette,
} from '@/constants/Colors';
import { useWallet } from '@/hooks/use-wallet';
import { useAuthStore } from '@/stores/auth-store';

export default function WalletTabScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const customer = useAuthStore((state) => state.customer);
  const { data, isLoading, refetch, isRefetching } = useWallet();

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!customer) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Wallet
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconContainer,
              { backgroundColor: palette.amber[50] },
            ]}
          >
            <Ionicons
              name="wallet-outline"
              size={48}
              color={palette.amber[500]}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Sign in to access your wallet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Track your balance, earn rewards, and redeem points
          </Text>
          <Pressable
            style={[styles.signInButton, { backgroundColor: BRAND.primary }]}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Wallet
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Wallet</Text>
        <Pressable
          style={styles.historyButton}
          onPress={() => router.push('/wallet')}
        >
          <Ionicons name="time-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={BRAND.primary}
          />
        }
      >
        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: '#0F0F0F' }]}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>
            {formatPrice(data?.wallet?.balance || 0)}
          </Text>
          <View style={styles.balanceActions}>
            <Pressable
              style={styles.balanceActionButton}
              onPress={() => router.push('/wallet')}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFF" />
              <Text style={styles.balanceActionText}>Add Funds</Text>
            </Pressable>
          </View>
        </View>

        {/* Points Card */}
        <View
          style={[styles.pointsCard, { backgroundColor: palette.amber[50] }]}
        >
          <View style={styles.pointsHeader}>
            <Ionicons name="sparkles" size={24} color={palette.amber[600]} />
            <Text style={[styles.pointsLabel, { color: palette.amber[800] }]}>
              Reward Points
            </Text>
          </View>
          <Text style={[styles.pointsAmount, { color: palette.amber[900] }]}>
            {(data?.wallet?.loyalty_points || 0).toLocaleString()} pts
          </Text>
          <Pressable
            style={[
              styles.redeemButton,
              { backgroundColor: palette.amber[500] },
            ]}
            onPress={() => router.push('/wallet')}
          >
            <Text style={styles.redeemButtonText}>Redeem Points</Text>
          </Pressable>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Quick Actions
          </Text>
          <View style={styles.quickActionsGrid}>
            <Pressable
              style={[styles.quickAction, { backgroundColor: colors.card }]}
              onPress={() => router.push('/orders')}
            >
              <Ionicons
                name="receipt-outline"
                size={24}
                color={BRAND.primary}
              />
              <Text style={[styles.quickActionLabel, { color: colors.text }]}>
                Orders
              </Text>
            </Pressable>
            <Pressable
              style={[styles.quickAction, { backgroundColor: colors.card }]}
              onPress={() => router.push('/wallet')}
            >
              <Ionicons
                name="gift-outline"
                size={24}
                color={palette.amber[500]}
              />
              <Text style={[styles.quickActionLabel, { color: colors.text }]}>
                Rewards
              </Text>
            </Pressable>
            <Pressable
              style={[styles.quickAction, { backgroundColor: colors.card }]}
              onPress={() => router.push('/faq')}
            >
              <Ionicons
                name="help-circle-outline"
                size={24}
                color={palette.gray[500]}
              />
              <Text style={[styles.quickActionLabel, { color: colors.text }]}>
                Help
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  historyButton: {
    padding: SPACING.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  signInButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  signInButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
    gap: SPACING.lg,
  },
  balanceCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    ...SHADOWS.lg,
  },
  balanceLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: SPACING.xs,
  },
  balanceAmount: {
    fontSize: 36,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    marginBottom: SPACING.lg,
  },
  balanceActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  balanceActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  balanceActionText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
  },
  pointsCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
  },
  pointsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  pointsLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  pointsAmount: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.md,
  },
  redeemButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  redeemButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  quickActionsSection: {
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: SPACING.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  quickAction: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  quickActionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
