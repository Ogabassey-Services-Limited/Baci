import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { styles } from '@/components/wallet/wallet-screen.styles';
import type Colors from '@/constants/Colors';
import { BRAND, palette } from '@/constants/Colors';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import {
  type WalletTransaction,
  WalletTransactionHistory,
} from './WalletTransactionHistory';

type WalletColors = (typeof Colors)['light'];
type WalletIconName = ComponentProps<typeof Ionicons>['name'];
const MIN_REDEEMABLE_POINTS = 100;

export interface WalletContentProps {
  colors: WalletColors;
  contentContainerStyle: StyleProp<ViewStyle>;
  isRedeemPending: boolean;
  isRefetching: boolean;
  loyaltyPoints: number;
  onChangeRedeemPoints: (value: string) => void;
  onConfirmRedeem: () => void;
  onOpenRedeemPanel: () => void;
  onRefresh: () => void;
  onResetRedeem: () => void;
  redeemPoints: string;
  showRedeemPanel: boolean;
  transactions: WalletTransaction[];
  walletBalance: number;
}

function getTierColor(tier: string) {
  switch (tier.toLowerCase()) {
    case 'gold':
      return palette.amber[500];
    case 'silver':
      return palette.gray[400];
    case 'platinum':
      return '#6366F1';
    default:
      return '#CD7F32';
  }
}

export function WalletContent({
  colors,
  contentContainerStyle,
  isRedeemPending,
  isRefetching,
  loyaltyPoints,
  onChangeRedeemPoints,
  onConfirmRedeem,
  onOpenRedeemPanel,
  onRefresh,
  onResetRedeem,
  redeemPoints,
  showRedeemPanel,
  transactions,
  walletBalance,
}: WalletContentProps) {
  const balanceActions: ReadonlyArray<{
    accessibilityLabel: string;
    icon: WalletIconName;
    key: string;
    label: string;
  }> = [
    {
      accessibilityLabel: 'Add funds to wallet',
      icon: 'add-circle-outline',
      key: 'add-funds',
      label: 'Add Funds',
    },
    {
      accessibilityLabel: 'Withdraw from wallet',
      icon: 'arrow-up-circle-outline',
      key: 'withdraw',
      label: 'Withdraw',
    },
  ];

  return (
    <ScrollView
      testID="wallet-scroll"
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={BRAND.primary}
        />
      }
    >
      <Animated.View
        entering={FadeIn.duration(400)}
        style={[styles.balanceCard, { backgroundColor: BRAND.primary }]}
      >
        <Text style={styles.balanceLabel}>Wallet Balance</Text>
        <Text style={styles.balanceAmount}>
          {formatNgnCurrency(walletBalance)}
        </Text>
        <View style={styles.balanceActions}>
          {balanceActions.map((action, index) => (
            <View key={action.key} style={styles.balanceAction}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
                accessibilityHint="This wallet action is not available yet"
                accessibilityState={{ disabled: true }}
                disabled
                style={styles.balanceAction}
              >
                <Ionicons name={action.icon} size={20} color="#FFFFFF" />
                <Text style={styles.balanceActionText}>{action.label}</Text>
              </Pressable>
              {index === 0 ? <View style={styles.divider} /> : null}
            </View>
          ))}
        </View>
      </Animated.View>

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
              {loyaltyPoints.toLocaleString()} pts
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
            <Ionicons
              accessible={false}
              importantForAccessibility="no"
              name="star"
              size={14}
              color="#FFFFFF"
            />
            <Text style={styles.tierText}>Bronze</Text>
          </View>
        </View>

        <View style={[styles.redeemSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.redeemInfo, { color: colors.textSecondary }]}>
            {MIN_REDEEMABLE_POINTS} points = ₦{MIN_REDEEMABLE_POINTS} wallet
            credit
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Redeem loyalty points"
            accessibilityHint="Opens the loyalty redemption panel"
            accessibilityState={{
              disabled: loyaltyPoints < MIN_REDEEMABLE_POINTS,
            }}
            style={({ pressed }) => [
              styles.redeemBtn,
              {
                backgroundColor: BRAND.primary,
                opacity:
                  loyaltyPoints < MIN_REDEEMABLE_POINTS
                    ? 0.45
                    : pressed
                      ? 0.8
                      : 1,
              },
            ]}
            onPress={onOpenRedeemPanel}
            disabled={loyaltyPoints < MIN_REDEEMABLE_POINTS}
          >
            <Ionicons
              accessible={false}
              importantForAccessibility="no"
              name="gift-outline"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.redeemBtnText}>Redeem Points</Text>
          </Pressable>
        </View>
      </Animated.View>

      {showRedeemPanel ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[
            styles.redeemPanel,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.redeemPanelTitle, { color: colors.text }]}>
            Redeem Loyalty Points
          </Text>
          <Text
            style={[
              styles.redeemPanelSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            Available: {loyaltyPoints.toLocaleString()} points
          </Text>

          <TextInput
            accessibilityLabel="Points to redeem"
            style={[
              styles.redeemInput,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={redeemPoints}
            onChangeText={onChangeRedeemPoints}
            keyboardType="number-pad"
            placeholder="Enter points to redeem (min 100)"
            placeholderTextColor={colors.placeholder}
          />

          <View style={styles.redeemPanelActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel redeem points"
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={onResetRedeem}
            >
              <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm redeem points"
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: BRAND.primary,
                  opacity: isRedeemPending ? 0.5 : 1,
                },
              ]}
              onPress={onConfirmRedeem}
              disabled={isRedeemPending}
            >
              {isRedeemPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>Redeem</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      <WalletTransactionHistory colors={colors} transactions={transactions} />
    </ScrollView>
  );
}
