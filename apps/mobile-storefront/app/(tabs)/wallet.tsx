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
  Text,
  View,
} from 'react-native';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { BRAND, palette } from '@/constants/Colors';
import { useAuthStatus } from '@/hooks/use-auth-guard';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import { useWallet } from '@/hooks/use-wallet';
import { useTheme } from '@/hooks/useTheme';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { WALLET_TAB_SCROLL_PADDING_BOTTOM } from './wallet.constants';
import { walletStyles as styles } from './wallet.styles';

export default function WalletTabScreen() {
  const { colors, isDark } = useTheme();
  const { data, isLoading, refetch, isRefetching } = useWallet();
  const { getScrollContentStyle } = useStorefrontInsets();

  // Auth gating handled by tab layout listener — this is a fallback for edge cases
  // e.g., user signs out while already viewing this tab (tabPress listener won't fire)
  const { isInitialized, user: authUser } = useAuthStatus();

  if (!isInitialized) {
    return (
      <StorefrontScreenShell
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
      </StorefrontScreenShell>
    );
  }

  // Defense-in-depth: if user signed out while on this tab, go to Home
  if (!authUser) {
    router.replace('/');
    return null;
  }

  if (isLoading) {
    return (
      <StorefrontScreenShell
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
      </StorefrontScreenShell>
    );
  }

  return (
    <StorefrontScreenShell
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Wallet</Text>
        <Pressable
          style={styles.historyButton}
          onPress={() => router.push('/wallet')}
          accessibilityRole="button"
          accessibilityLabel="Open wallet history"
        >
          <Ionicons name="time-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        testID="wallet-scrollview"
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          getScrollContentStyle({
            includeBottomInset: false,
            paddingBottom: WALLET_TAB_SCROLL_PADDING_BOTTOM,
          }),
        ]}
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
        <View style={[styles.balanceCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>
            Available Balance
          </Text>
          <Text style={[styles.balanceAmount, { color: colors.text }]}>
            {formatNgnCurrency(data?.wallet?.balance ?? 0)}
          </Text>
          <View style={styles.balanceActions}>
            <Pressable
              style={[
                styles.balanceActionButton,
                { backgroundColor: colors.muted },
              ]}
              onPress={() => router.push('/wallet')}
              accessibilityRole="button"
              accessibilityLabel="Add funds from wallet tab"
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={colors.text}
              />
              <Text style={[styles.balanceActionText, { color: colors.text }]}>
                Add Funds
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Points Card */}
        <View
          style={[
            styles.pointsCard,
            { backgroundColor: isDark ? colors.card : palette.amber[50] },
          ]}
        >
          <View style={styles.pointsHeader}>
            <Ionicons name="sparkles" size={24} color={palette.amber[600]} />
            <Text
              style={[
                styles.pointsLabel,
                { color: isDark ? palette.amber[400] : palette.amber[800] },
              ]}
            >
              Reward Points
            </Text>
          </View>
          <Text
            style={[
              styles.pointsAmount,
              { color: isDark ? palette.amber[400] : palette.amber[900] },
            ]}
          >
            {(data?.wallet?.loyalty_points ?? 0).toLocaleString()} pts
          </Text>
          <Pressable
            style={[
              styles.redeemButton,
              { backgroundColor: palette.amber[500] },
            ]}
            onPress={() => router.push('/wallet')}
            accessibilityRole="button"
            accessibilityLabel="Redeem reward points"
          >
            <Text
              style={[
                styles.redeemButtonText,
                { color: colors.secondaryForeground },
              ]}
            >
              Redeem Points
            </Text>
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
              accessibilityRole="button"
              accessibilityLabel="Open orders"
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
              accessibilityRole="button"
              accessibilityLabel="Open rewards"
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
              accessibilityRole="button"
              accessibilityLabel="Open help"
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
    </StorefrontScreenShell>
  );
}
