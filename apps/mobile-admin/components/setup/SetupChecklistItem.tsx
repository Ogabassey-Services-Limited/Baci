import type {
  MobileStoreReadinessItemId,
  StoreReadinessItem,
} from '@baci/shared';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

const PRIORITY_LABELS = {
  optional: 'Optional',
  recommended: 'Recommended',
  required: 'Required',
};

type SetupChecklistItemProps = {
  colors: ThemeColors;
  isNext: boolean;
  item: StoreReadinessItem<MobileStoreReadinessItemId>;
  onPress: () => void;
};

export function SetupChecklistItem({
  colors,
  isNext,
  item,
  onPress,
}: SetupChecklistItemProps) {
  const priorityColor = getPriorityColors(colors)[item.priority];

  return (
    <Pressable
      accessibilityHint={
        item.completed
          ? 'Completed. Opens this setup item.'
          : 'Incomplete. Opens this setup item.'
      }
      accessibilityLabel={`${item.label}, ${item.completed ? 'completed' : 'incomplete'}`}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.itemCard,
        {
          backgroundColor: colors.card,
          borderColor: item.completed
            ? colors.successLight
            : isNext
              ? colors.primary
              : colors.border,
          borderWidth: isNext ? 2 : 1,
        },
        item.completed && { opacity: 0.8 },
      ]}
    >
      <View
        style={[
          styles.statusIcon,
          {
            backgroundColor: item.completed
              ? colors.successLight
              : isNext
                ? colors.primaryLight
                : colors.cardHover,
          },
        ]}
      >
        <Ionicons
          name={
            item.completed
              ? 'checkmark'
              : isNext
                ? 'arrow-forward'
                : 'ellipse-outline'
          }
          size={18}
          color={
            item.completed
              ? colors.success
              : isNext
                ? colors.primary
                : colors.textSecondary
          }
        />
      </View>

      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text
            style={[
              styles.itemLabel,
              {
                color: colors.text,
                textDecorationLine: item.completed ? 'line-through' : 'none',
              },
            ]}
          >
            {item.label}
          </Text>
          {!item.completed && !isNext && (
            <PriorityBadge
              backgroundColor={priorityColor.bg}
              borderColor={priorityColor.border}
              color={priorityColor.text}
              label={PRIORITY_LABELS[item.priority]}
            />
          )}
          {isNext && (
            <PriorityBadge
              backgroundColor={colors.primaryLight}
              borderColor={colors.primary}
              color={colors.primary}
              label="NEXT STEP"
            />
          )}
        </View>
        <Text
          style={[styles.itemDescription, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {item.description}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function PriorityBadge({
  backgroundColor,
  borderColor,
  color,
  label,
}: {
  backgroundColor: string;
  borderColor: string;
  color: string;
  label: string;
}) {
  return (
    <View style={[styles.priorityBadge, { backgroundColor, borderColor }]}>
      <Text style={[styles.priorityText, { color }]}>{label}</Text>
    </View>
  );
}

function getPriorityColors(colors: ThemeColors) {
  return {
    optional: {
      bg: colors.infoLight,
      border: colors.info,
      text: colors.info,
    },
    recommended: {
      bg: colors.warningLight,
      border: colors.warning,
      text: colors.warning,
    },
    required: {
      bg: colors.errorLight,
      border: colors.error,
      text: colors.error,
    },
  };
}

const styles = StyleSheet.create({
  itemCard: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    padding: SPACING.md,
  },
  itemContent: { flex: 1, marginRight: SPACING.sm },
  itemDescription: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.xs,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  itemLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
    marginRight: SPACING.sm,
  },
  priorityBadge: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priorityText: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  statusIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    marginRight: SPACING.md,
    width: 32,
  },
});
