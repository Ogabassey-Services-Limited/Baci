import { Ionicons } from '@expo/vector-icons';
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
              backgroundColor: isPro
                ? (colors.primaryLight ?? colors.cardHover ?? colors.background)
                : (colors.cardHover ?? colors.background),
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
        accessibilityLabel={
          isPro ? 'View current subscription' : 'Upgrade to Pro'
        }
        accessibilityRole="button"
        onPress={onOpenSubscriptionPlans}
        style={[
          styles.actionCard,
          { backgroundColor: colors.cardHover ?? colors.background },
        ]}
      >
        <View style={styles.actionCopy}>
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  colors.primaryLight ?? colors.cardHover ?? colors.background,
              },
            ]}
          >
            <Ionicons color={colors.primary} name="star" size={20} />
          </View>
          <View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>
              {isPro ? 'Baci Pro' : 'Upgrade to Pro'}
            </Text>
            <Text
              style={[styles.actionSubtitle, { color: colors.textSecondary }]}
            >
              {isPro ? 'View plan features' : 'Unlock premium features'}
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
          style={[
            styles.actionCard,
            {
              backgroundColor: colors.cardHover ?? colors.background,
              marginBottom: 0,
            },
          ]}
        >
          <View style={styles.actionCopy}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    colors.backgroundLight ??
                    colors.cardHover ??
                    colors.background,
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
                Cancel or change tiers
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
