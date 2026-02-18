import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import type { Biller } from '@/hooks/use-vtu-billers';

interface BillerListProps {
  billers: Biller[];
  selectedBillerId: string | null;
  onSelect: (biller: Biller) => void;
  isLoading: boolean;
  emptyMessage?: string;
  errorMessage?: string;
}

export function BillerList({
  billers,
  selectedBillerId,
  onSelect,
  isLoading,
  emptyMessage = 'No providers available',
  errorMessage,
}: BillerListProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={BRAND.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading providers...
        </Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  if (billers.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {billers.map((biller) => {
        const isSelected = selectedBillerId === biller.billerId;
        return (
          <Pressable
            key={biller.billerId}
            style={[
              styles.billerChip,
              {
                backgroundColor: isSelected ? BRAND.primary : colors.card,
                borderColor: isSelected ? BRAND.primary : colors.border,
              },
            ]}
            onPress={() => onSelect(biller)}
          >
            <Text
              style={[
                styles.billerName,
                { color: isSelected ? '#FFF' : colors.text },
              ]}
              numberOfLines={1}
            >
              {biller.billerName}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: 8,
    paddingVertical: 4,
  },
  billerChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  billerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  centered: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center' as const,
    color: '#DC2626',
  },
});
