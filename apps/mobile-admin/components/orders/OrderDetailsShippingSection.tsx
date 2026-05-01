import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';

interface OrderDetailsShippingSectionProps {
  address: string;
  colors: ThemeColors;
}

export function OrderDetailsShippingSection({
  address,
  colors,
}: OrderDetailsShippingSectionProps) {
  return (
    <View
      accessibilityLabel="Shipping address"
      accessibilityRole="summary"
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Ionicons
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          name="location-outline"
          size={18}
          color={colors.text}
        />
        <Text style={[styles.title, { color: colors.text }]}>
          Shipping Address
        </Text>
      </View>
      <Text style={[styles.addressText, { color: colors.textSecondary }]}>
        {address}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  addressText: {
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
});
