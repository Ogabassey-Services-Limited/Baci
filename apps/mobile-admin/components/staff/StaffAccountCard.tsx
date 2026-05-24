import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { StaffAccount, StaffColors } from './types';

interface StaffAccountCardProps extends StaffColors {
  account: StaffAccount;
  onCopyAccountNumber: (text: string) => void;
}

export function StaffAccountCard({
  account,
  colors,
  shadows,
  onCopyAccountNumber,
}: StaffAccountCardProps) {
  const accountNumber = account.account_number;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View
            style={[styles.cardIcon, { backgroundColor: colors.primaryLight }]}
          >
            <Ionicons name="person" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {account.name}
            </Text>
            <Text
              style={[styles.cardSubtitle, { color: colors.textSecondary }]}
            >
              {account.code}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: account.active
                ? colors.successLight
                : colors.cardHover,
            },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              {
                color: account.active ? colors.success : colors.textMuted,
              },
            ]}
          >
            {account.active ? 'ACTIVE' : 'INACTIVE'}
          </Text>
        </View>
      </View>

      {accountNumber ? (
        <Pressable
          style={[styles.accountDetail, { backgroundColor: colors.cardHover }]}
          onPress={() => onCopyAccountNumber(accountNumber)}
          accessibilityRole="button"
          accessibilityLabel={`Copy account number for ${account.name}`}
        >
          <View>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
              Account Number
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {accountNumber}
            </Text>
            <Text style={[styles.detailBank, { color: colors.textSecondary }]}>
              {account.bank}
            </Text>
          </View>
          <Ionicons name="copy-outline" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  cardSubtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  accountDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  detailLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  detailBank: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
});
