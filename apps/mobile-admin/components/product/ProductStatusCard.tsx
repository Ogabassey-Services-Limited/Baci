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
          {status === 'active'
            ? 'Product is visible to customers.'
            : 'Product is hidden from store.'}
        </Text>
      </View>
      <Switch
        value={status === 'active'}
        disabled={isPending}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={status === 'active' ? colors.primary : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
