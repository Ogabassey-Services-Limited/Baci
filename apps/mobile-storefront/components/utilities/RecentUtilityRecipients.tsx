import Ionicons from '@react-native-vector-icons/ionicons';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { RADIUS, SPACING, withAlpha } from '@/constants/Colors';
import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';
import { MOCK_RECENT_RECIPIENTS } from './fixtures/recent-recipients.fixtures';

const AVATAR_SIZE = 40;
const PREVIEW_COUNT = 2;

interface RecentUtilityRecipientsProps {
  colors: typeof Colors.light;
  recipients: UtilityRepeatRecipient[];
  onSelect: (recipient: UtilityRepeatRecipient) => void;
  embedded?: boolean;
  label?: string;
}

function getInitials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'R';
  if (parts.length === 1) return (parts[0] ?? 'R').slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

export function RecentUtilityRecipients({
  colors,
  recipients,
  onSelect,
  embedded = false,
  label,
}: RecentUtilityRecipientsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  let activeRecipients = recipients;
  if (recipients.length === 0) {
    if (
      typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      process.env.NODE_ENV !== 'test'
    ) {
      activeRecipients = MOCK_RECENT_RECIPIENTS;
    } else {
      return null;
    }
  }

  const visibleRecipients = isExpanded
    ? activeRecipients
    : activeRecipients.slice(0, PREVIEW_COUNT);
  const canExpand = activeRecipients.length > PREVIEW_COUNT;

  const content = (
    <>
      {visibleRecipients.map((recipient, index) => (
        <Fragment key={recipient.id}>
          {index > 0 ? (
            <View style={[styles.divider, { borderTopColor: colors.border }]} />
          ) : null}
          <View style={styles.itemWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.pressable,
                pressed && { backgroundColor: withAlpha(colors.tint, 0.06) },
              ]}
              onPress={() => onSelect(recipient)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${recipient.title}, ${recipient.identifierLabel} ${recipient.identifier}`}
            >
              <View
                style={[
                  styles.row,
                  embedded && { paddingHorizontal: 0, minHeight: 56 },
                ]}
              >
                <View
                  style={[styles.avatar, { backgroundColor: colors.muted }]}
                >
                  <Text style={[styles.avatarText, { color: colors.accent }]}>
                    {getInitials(recipient.title)}
                  </Text>
                </View>
                <View style={styles.copy}>
                  <Text
                    style={[
                      styles.title,
                      { color: colors.text, textTransform: 'uppercase' },
                    ]}
                    numberOfLines={1}
                  >
                    {recipient.title}
                  </Text>
                  <Text
                    style={[styles.detail, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {recipient.identifierLabel}: {recipient.identifier}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textSecondary}
                />
              </View>
            </Pressable>
          </View>
        </Fragment>
      ))}
      {canExpand ? (
        <Pressable
          style={[styles.seeAll, { borderTopColor: colors.border }]}
          onPress={() => setIsExpanded((current) => !current)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          accessibilityLabel={
            isExpanded ? 'Show fewer beneficiaries' : 'See all beneficiaries'
          }
        >
          <Text style={[styles.seeAllText, { color: colors.tint }]}>
            {isExpanded ? 'Show less' : 'See all'}
          </Text>
        </Pressable>
      ) : null}
    </>
  );

  if (embedded) {
    return <View>{content}</View>;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label ?? 'Select Beneficiary'}
      </Text>
      <View
        style={[
          styles.list,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    marginBottom: SPACING.xs,
  },
  list: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    minHeight: 64,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    width: AVATAR_SIZE,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
  },
  detail: {
    fontSize: 12,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  seeAll: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 44,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemWrapper: {
    width: '100%',
  },
  pressable: {
    width: '100%',
  },
});
