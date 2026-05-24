import Ionicons from "@react-native-vector-icons/ionicons/static";
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';
import type { ThemeColors, ThemeShadows } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface SubscriptionStatusCardProps {
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  colors: ThemeColors;
  shadows: ThemeShadows;
  onPress: () => void;
}

const POSSIBLE_PRO_KEYS = [
  'pro',
  'baci_pro',
  'premium',
  'all_features',
  'monthly',
  'yearly',
  'default',
];

function getLatestProEntitlement(customerInfo: CustomerInfo | null) {
  if (!customerInfo) return null;

  const proEntitlements = Object.entries(customerInfo.entitlements.active)
    .filter(([key]) => POSSIBLE_PRO_KEYS.includes(key.toLowerCase()))
    .map(([, entitlement]) => entitlement);

  if (proEntitlements.length === 0) {
    return null;
  }

  return proEntitlements.reduce((latestEntitlement, currentEntitlement) => {
    const latestExpiry = latestEntitlement.expirationDate
      ? new Date(latestEntitlement.expirationDate).getTime()
      : Number.NEGATIVE_INFINITY;
    const currentExpiry = currentEntitlement.expirationDate
      ? new Date(currentEntitlement.expirationDate).getTime()
      : Number.NEGATIVE_INFINITY;

    return currentExpiry > latestExpiry
      ? currentEntitlement
      : latestEntitlement;
  });
}

export function SubscriptionStatusCard({
  isPro,
  customerInfo,
  colors,
  shadows,
  onPress,
}: SubscriptionStatusCardProps) {
  const activeEntitlement = getLatestProEntitlement(customerInfo);

  const expiryDate = activeEntitlement?.expirationDate
    ? new Date(activeEntitlement.expirationDate).toLocaleDateString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : null;

  if (isPro) {
    return (
      <Pressable
        style={[styles.subCardContainer, shadows.md]}
        onPress={onPress}
        accessibilityLabel={`Baci Pro Merchant subscription. ${expiryDate ? `Active until ${expiryDate}` : 'Active'}. Tap to manage subscription`}
        accessibilityRole="button"
        accessibilityHint="Opens subscription management"
      >
        <LinearGradient
          colors={['#D62027', '#9B1014']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.subCardGradient}
        >
          <View style={styles.subCardMain}>
            <View style={styles.subCardIconContainer}>
              <Ionicons name="ribbon" size={28} color={colors.textOnPrimary} />
            </View>
            <View style={styles.subCardInfo}>
              <View style={styles.subCardStatusRow}>
                <Text
                  style={[styles.subCardTitle, { color: colors.textOnPrimary }]}
                >
                  Baci Pro Merchant
                </Text>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.textOnPrimary}
                />
              </View>
              <Text
                style={[
                  styles.subCardStatusText,
                  { color: colors.textOnPrimary },
                ]}
              >
                Active{expiryDate ? `: Valid till ${expiryDate}` : ''}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="rgba(255,255,255,0.7)"
            />
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[
        styles.freeCardContainer,
        { backgroundColor: colors.card },
        shadows.sm,
      ]}
      onPress={onPress}
      accessibilityLabel="Free Plan. Upgrade to Pro for more features"
      accessibilityRole="button"
      accessibilityHint="Opens subscription upgrade options"
    >
      <View
        style={[styles.freeCardIcon, { backgroundColor: colors.goldLight }]}
      >
        <Ionicons name="star" size={24} color={colors.gold} />
      </View>
      <View style={styles.freeCardContent}>
        <Text style={[styles.freeCardTitle, { color: colors.text }]}>
          Free Plan
        </Text>
        <Text
          style={[styles.freeCardSubtitle, { color: colors.textSecondary }]}
        >
          Upgrade to Pro for more features
        </Text>
      </View>
      <View style={[styles.freeCardBadge, { backgroundColor: colors.gold }]}>
        <Text style={styles.freeCardBadgeText}>UPGRADE</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subCardContainer: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  subCardGradient: {
    padding: SPACING.lg,
  },
  subCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  subCardInfo: {
    flex: 1,
  },
  subCardStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subCardTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  subCardStatusText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: 2,
  },
  freeCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  freeCardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  freeCardContent: {
    flex: 1,
  },
  freeCardTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  freeCardSubtitle: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  freeCardBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  freeCardBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
});
