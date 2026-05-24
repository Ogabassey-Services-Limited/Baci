import Ionicons from "@react-native-vector-icons/ionicons/static";
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

const PLAN_BADGE_VERTICAL_PADDING = SPACING.xs / 2;
const ACTION_ICON_CONTAINER_SIZE = SPACING.xl * 2;
const SUBSCRIPTION_COPY = {
  manageSubtitle: 'Cancel or change tiers',
  pro: {
    accessibilityLabel: 'View current subscription',
    subtitle: 'View plan features',
    title: 'Baci Pro',
  },
  upgrade: {
    accessibilityLabel: 'Upgrade to Pro',
    subtitle: 'Unlock premium features',
    title: 'Upgrade to Pro',
  },
} as const;

interface StoreSubscriptionCardProps {
  colors: ThemeColors;
  isPro: boolean;
  manageSubscriptionLabel: string;
  onManageSubscription: () => void;
  onOpenSubscriptionPlans: () => void;
  planLabel: string;
  shadowStyle: StyleProp<ViewStyle>;
}

export function StoreSubscriptionCard({
  colors,
  isPro,
  manageSubscriptionLabel,
  onManageSubscription,
  onOpenSubscriptionPlans,
  planLabel,
  shadowStyle,
}: StoreSubscriptionCardProps) {
  const primaryAccentBackground =
    colors.primaryLight ?? colors.cardHover ?? colors.background;
  const secondaryAccentBackground =
    colors.backgroundLight ?? colors.cardHover ?? colors.background;
  const actionCardBackground = colors.cardHover ?? colors.background;
  const pressedActionCardBackground = secondaryAccentBackground;
  const planBadgeBackground = isPro
    ? primaryAccentBackground
    : actionCardBackground;
  const primaryActionCopy = isPro
    ? SUBSCRIPTION_COPY.pro
    : SUBSCRIPTION_COPY.upgrade;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Subscription Plan
        </Text>
        <View
          style={[
            styles.planBadge,
            {
              backgroundColor: planBadgeBackground,
            },
          ]}
        >
          <Text
            style={[
              styles.planBadgeText,
              { color: isPro ? colors.primary : colors.textSecondary },
            ]}
          >
            {planLabel}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityLabel={primaryActionCopy.accessibilityLabel}
        accessibilityRole="button"
        onPress={onOpenSubscriptionPlans}
        style={({ pressed }) => [
          styles.actionCard,
          {
            backgroundColor: pressed
              ? pressedActionCardBackground
              : actionCardBackground,
          },
        ]}
      >
        <View style={styles.actionCopy}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: primaryAccentBackground,
              },
            ]}
          >
            <Ionicons color={colors.primary} name="star" size={20} />
          </View>
          <View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>
              {primaryActionCopy.title}
            </Text>
            <Text
              style={[styles.actionSubtitle, { color: colors.textSecondary }]}
            >
              {primaryActionCopy.subtitle}
            </Text>
          </View>
        </View>
        <Ionicons
          color={colors.textSecondary}
          name="chevron-forward"
          size={20}
        />
      </Pressable>

      {isPro ? (
        <Pressable
          accessibilityLabel={manageSubscriptionLabel}
          accessibilityRole="button"
          onPress={onManageSubscription}
          style={({ pressed }) => [
            styles.actionCard,
            {
              backgroundColor: pressed
                ? pressedActionCardBackground
                : actionCardBackground,
              marginBottom: 0,
            },
          ]}
        >
          <View style={styles.actionCopy}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: secondaryAccentBackground,
                },
              ]}
            >
              <Ionicons
                color={colors.textSecondary}
                name="settings-outline"
                size={20}
              />
            </View>
            <View>
              <Text style={[styles.actionTitle, { color: colors.text }]}>
                {manageSubscriptionLabel}
              </Text>
              <Text
                style={[styles.actionSubtitle, { color: colors.textSecondary }]}
              >
                {SUBSCRIPTION_COPY.manageSubtitle}
              </Text>
            </View>
          </View>
          <Ionicons
            color={colors.textSecondary}
            name="open-outline"
            size={18}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
  planBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: PLAN_BADGE_VERTICAL_PADDING,
  },
  planBadgeText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size.xs,
    textTransform: 'uppercase',
  },
  actionCard: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  actionCopy: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
  },
  iconContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    height: ACTION_ICON_CONTAINER_SIZE,
    justifyContent: 'center',
    marginRight: SPACING.md,
    width: ACTION_ICON_CONTAINER_SIZE,
  },
  actionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  actionSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
