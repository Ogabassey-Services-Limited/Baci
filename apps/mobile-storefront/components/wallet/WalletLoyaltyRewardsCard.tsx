import {
  getRedeemablePointBalance,
  VTU_MIN_REDEEMABLE_POINTS,
} from '@baci/shared/lib';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type Colors from '@/constants/Colors';
import { BRAND, palette } from '@/constants/Colors';
import { WALLET_COLORS } from './wallet.colors';
import { styles } from './wallet.styles';

type WalletColors = (typeof Colors)['light'];

interface WalletLoyaltyRewardsCardProps {
  colors: WalletColors;
  loyaltyPoints: number;
  onOpenRedeemPanel: () => void;
  tier?: string | null;
}

function formatTierLabel(tier: string | null | undefined) {
  const normalizedTier = tier?.trim() || 'Bronze';
  return `${normalizedTier.charAt(0).toUpperCase()}${normalizedTier.slice(1)}`;
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

export function WalletLoyaltyRewardsCard({
  colors,
  loyaltyPoints,
  onOpenRedeemPanel,
  tier,
}: WalletLoyaltyRewardsCardProps) {
  const redeemablePoints = getRedeemablePointBalance(loyaltyPoints);
  const canRedeemPoints = loyaltyPoints >= VTU_MIN_REDEEMABLE_POINTS;
  const tierLabel = formatTierLabel(tier);

  return (
    <Animated.View
      entering={FadeIn.duration(400).delay(100)}
      style={[
        styles.loyaltyCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.loyaltyHeader}>
        <Text style={[styles.loyaltyLabel, { color: colors.textSecondary }]}>
          Redeem Rewards
        </Text>
        <View
          style={[
            styles.tierBadge,
            {
              backgroundColor: getTierColor(tierLabel),
            },
          ]}
        >
          <Ionicons
            accessible={false}
            importantForAccessibility="no"
            name="star"
            size={14}
            color={WALLET_COLORS.white}
          />
          <Text style={styles.tierText}>{tierLabel}</Text>
        </View>
      </View>

      <View style={[styles.redeemSection, { borderTopColor: colors.border }]}>
        <Text style={[styles.redeemInfo, { color: colors.textSecondary }]}>
          {`${redeemablePoints.toLocaleString()} points redeemable now (${VTU_MIN_REDEEMABLE_POINTS} points = ₦${VTU_MIN_REDEEMABLE_POINTS})`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Redeem loyalty points"
          accessibilityHint="Opens the loyalty redemption panel"
          accessibilityState={{ disabled: !canRedeemPoints }}
          style={({ pressed }) => [
            styles.redeemBtn,
            {
              backgroundColor: BRAND.primary,
              opacity: !canRedeemPoints ? 0.45 : pressed ? 0.8 : 1,
            },
          ]}
          onPress={onOpenRedeemPanel}
          disabled={!canRedeemPoints}
        >
          <Ionicons
            accessible={false}
            importantForAccessibility="no"
            name="gift-outline"
            size={18}
            color={WALLET_COLORS.white}
          />
          <Text style={styles.redeemBtnText}>Redeem Points</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
