import { Ionicons } from '@expo/vector-icons';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { RADIUS, SPACING, withAlpha } from '@/constants/Colors';
import type { UtilityRepeatRecipient } from '@/lib/utility-repeat';

const AVATAR_SIZE = 40;
const PREVIEW_COUNT = 2;

interface RecentUtilityRecipientsProps {
  colors: typeof Colors.light;
  recipients: UtilityRepeatRecipient[];
  onSelect: (recipient: UtilityRepeatRecipient) => void;
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
}: RecentUtilityRecipientsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (recipients.length === 0) {
    return null;
  }

  const visibleRecipients = isExpanded
    ? recipients
    : recipients.slice(0, PREVIEW_COUNT);
  const canExpand = recipients.length > PREVIEW_COUNT;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Select Beneficiary
      </Text>
      <View
        style={[
          styles.list,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {visibleRecipients.map((recipient, index) => (
          <Fragment key={recipient.id}>
            {index > 0 ? (
              <View
                style={[styles.divider, { borderTopColor: colors.border }]}
              />
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: withAlpha(colors.tint, 0.06) },
              ]}
              onPress={() => onSelect(recipient)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${recipient.title}, ${recipient.identifierLabel} ${recipient.identifier}`}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: withAlpha(colors.tint, 0.12) },
                ]}
              >
                <Text style={[styles.avatarText, { color: colors.tint }]}>
                  {getInitials(recipient.title)}
                </Text>
              </View>
              <View style={styles.copy}>
                <Text
                  style={[styles.title, { color: colors.text }]}
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
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {recipient.meta}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
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
});
