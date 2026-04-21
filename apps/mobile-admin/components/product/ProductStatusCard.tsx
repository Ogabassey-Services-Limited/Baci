import { StyleSheet, Switch, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';

interface ProductStatusCardProps {
  colors: ThemeColors;
  isPending: boolean;
  onValueChange: (value: boolean) => void;
  status: 'active' | 'draft' | 'archived';
}

export function ProductStatusCard({
  colors,
  isPending,
  onValueChange,
  status,
}: ProductStatusCardProps) {
  const isArchived = status === 'archived';
  const switchLabel = isArchived ? 'Reactivate product' : 'Product status';

  return (
    <View
      style={[
        styles.card,
        {
          alignItems: 'center',
          backgroundColor: colors.card,
          borderColor: colors.border,
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
      ]}
    >
      <View>
        <Text style={[styles.title, { color: colors.text }]}>
          Product Status
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {isArchived
            ? 'Product is archived. Turn it back on to relist it.'
            : status === 'active'
              ? 'Product is visible to customers.'
              : 'Product is hidden from store.'}
        </Text>
      </View>
      <View style={styles.actions}>
        {isArchived ? (
          <View
            style={[
              styles.archivedBadge,
              { backgroundColor: colors.inputBg, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.archivedLabel, { color: colors.textSecondary }]}
            >
              Archived
            </Text>
          </View>
        ) : null}
        <Switch
          accessibilityLabel={switchLabel}
          accessibilityRole="switch"
          value={status === 'active'}
          disabled={isPending}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={status === 'active' ? colors.primary : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  archivedBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  archivedLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  description: {
    fontSize: 13,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
});
