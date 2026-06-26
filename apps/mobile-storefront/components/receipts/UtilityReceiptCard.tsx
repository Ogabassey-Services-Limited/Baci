import Ionicons from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, SHADOWS } from '@/constants/Colors';
import type { VTUHistoryTransaction } from '@/hooks/use-vtu-history';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const TYPE_META: Record<string, { icon: IoniconName; label: string }> = {
  airtime: { icon: 'call-outline', label: 'Airtime' },
  data: { icon: 'wifi-outline', label: 'Data' },
  tv: { icon: 'tv-outline', label: 'TV' },
  power: { icon: 'flash-outline', label: 'Electricity' },
  electricity: { icon: 'flash-outline', label: 'Electricity' },
  gaming: { icon: 'game-controller-outline', label: 'Betting' },
  betting: { icon: 'game-controller-outline', label: 'Betting' },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  successful: { label: 'Receipt', color: '#059669' },
  pending: { label: 'Pending', color: '#D97706' },
  processing: { label: 'Pending', color: '#D97706' },
  failed: { label: 'Failed', color: '#DC2626' },
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface UtilityReceiptCardProps {
  transaction: VTUHistoryTransaction;
  colors: typeof Colors.light;
  onView: (transaction: VTUHistoryTransaction) => void;
}

export function UtilityReceiptCard({
  transaction,
  colors,
  onView,
}: UtilityReceiptCardProps) {
  const meta = TYPE_META[transaction.type] ?? {
    icon: 'receipt-outline' as IoniconName,
    label: transaction.type,
  };
  const status = STATUS_META[transaction.status] ?? STATUS_META.pending;
  const primary =
    transaction.network_provider ||
    transaction.biller_name ||
    `${meta.label} purchase`;
  const detail =
    transaction.phone_number || transaction.customer_identifier || '';

  return (
    <TouchableOpacity
      style={[styles.card, SHADOWS.sm, { backgroundColor: colors.card }]}
      onPress={() => onView(transaction)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label} receipt for ${primary}`}
    >
      <View style={styles.header}>
        <View style={[styles.thumb, { backgroundColor: `${BRAND.primary}12` }]}>
          <Ionicons name={meta.icon} size={22} color={BRAND.primary} />
        </View>
        <View style={styles.copy}>
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
          >
            {primary} · {meta.label}
          </Text>
          <Text
            style={[styles.meta, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {detail ? `${detail} · ` : ''}
            {formatDate(transaction.created_at)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${status.color}15` }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            Amount
          </Text>
          <Text style={[styles.amount, { color: colors.text }]}>
            {formatNgnCurrency(transaction.amount)}
          </Text>
        </View>
        <View style={styles.viewAction}>
          <Text style={[styles.viewActionText, { color: BRAND.primary }]}>
            View receipt
          </Text>
          <Ionicons name="chevron-forward" size={16} color={BRAND.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    marginTop: 3,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
  },
  amountLabel: {
    fontSize: 12,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  viewAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
