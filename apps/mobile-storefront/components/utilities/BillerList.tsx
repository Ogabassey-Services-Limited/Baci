import {
  ActivityIndicator,
  Image,
  Pressable,
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

function BillerInitial({
  name,
  colors,
}: {
  name: string;
  colors: { textSecondary: string; border: string };
}) {
  return (
    <View style={[styles.initialsCircle, { backgroundColor: colors.border }]}>
      <Text style={[styles.initialsText, { color: colors.textSecondary }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
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
    <View style={styles.grid}>
      {billers.map((biller) => {
        const isSelected = selectedBillerId === biller.billerId;
        return (
          <Pressable
            key={biller.billerId}
            style={[
              styles.card,
              {
                backgroundColor: isSelected ? BRAND.primary : colors.card,
                borderColor: isSelected ? BRAND.primary : colors.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => onSelect(biller)}
          >
            {biller.billerIconUrl ? (
              <Image
                source={{ uri: biller.billerIconUrl }}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <BillerInitial name={biller.billerName} colors={colors} />
            )}
            <Text
              style={[
                styles.billerName,
                { color: isSelected ? '#FFF' : colors.text },
              ]}
              numberOfLines={2}
            >
              {biller.billerName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 60,
    height: 40,
    marginBottom: 8,
  },
  initialsCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  initialsText: {
    fontSize: 20,
    fontWeight: '700',
  },
  billerName: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
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
