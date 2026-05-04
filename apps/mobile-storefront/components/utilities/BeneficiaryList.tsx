import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { RADIUS, SPACING } from '@/constants/Colors';
import type { UtilityBeneficiary } from '@/lib/utility-beneficiaries';

const AVATAR_SIZE = 40;

const AVATAR_COLORS = [
  '#4B6BFB',
  '#7C3AED',
  '#059669',
  '#D97706',
  '#0891B2',
  '#DB2777',
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffff;
  }
  return (
    AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]
  );
}

interface BeneficiaryListProps {
  beneficiaries: UtilityBeneficiary[];
  colors: typeof Colors.light;
  onSelect: (beneficiary: UtilityBeneficiary) => void;
}

export function BeneficiaryList({
  beneficiaries,
  colors,
  onSelect,
}: BeneficiaryListProps) {
  if (beneficiaries.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Select Beneficiary
      </Text>
      <FlatList
        data={beneficiaries}
        keyExtractor={(item) => item.id}
        style={[
          styles.list,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        renderItem={({ item }) => {
          const initials = getInitials(item.customerName);
          const avatarColor = getAvatarColor(item.id);

          return (
            <Pressable
              style={styles.row}
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${item.customerName}, Meter Number ${item.customerId}`}
            >
              <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.info}>
                <Text
                  style={[styles.name, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.customerName.toUpperCase()}
                </Text>
                <Text style={[styles.meter, { color: colors.textSecondary }]}>
                  Meter Number: {item.customerId}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => (
          <View
            style={{
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: SPACING.sm },
  label: { fontSize: 13, marginBottom: SPACING.xs },
  list: { borderRadius: RADIUS.xl, borderWidth: 1, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: AVATAR_SIZE / 2,
    height: AVATAR_SIZE,
    justifyContent: 'center',
    width: AVATAR_SIZE,
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600' },
  meter: { fontSize: 12, marginTop: 2 },
});
