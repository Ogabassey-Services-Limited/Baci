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
import { BillerInitial } from './BillerInitial';

interface BillerListProps {
  billers: Biller[];
  selectedBillerId: string | null;
  onSelect: (biller: Biller) => void;
  isLoading: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  isCollapsed?: boolean;
  onChangeSelection?: () => void;
  selectedLabel?: string;
}

export function BillerList({
  billers,
  selectedBillerId,
  onSelect,
  isLoading,
  emptyMessage = 'No providers available',
  errorMessage,
  isCollapsed = false,
  onChangeSelection,
  selectedLabel = 'Provider',
}: BillerListProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const selectedBiller =
    billers.find((biller) => biller.billerId === selectedBillerId) ?? null;

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

  if (isCollapsed && !selectedBiller) {
    return null;
  }

  if (isCollapsed && selectedBiller) {
    return (
      <View
        style={[
          styles.selectedCard,
          {
            backgroundColor: `${BRAND.primary}10`,
            borderColor: BRAND.primary,
          },
        ]}
      >
        <View style={styles.selectedCardMain}>
          {selectedBiller.billerIconUrl ? (
            <Image
              source={{ uri: selectedBiller.billerIconUrl }}
              style={styles.selectedLogo}
              resizeMode="contain"
            />
          ) : (
            <BillerInitial name={selectedBiller.billerName} colors={colors} />
          )}
          <View style={styles.selectedCopy}>
            <Text
              style={[styles.selectedLabel, { color: colors.textSecondary }]}
            >
              {selectedLabel}
            </Text>
            <Text
              style={[styles.selectedName, { color: colors.text }]}
              numberOfLines={1}
            >
              {selectedBiller.billerName}
            </Text>
          </View>
        </View>
        {onChangeSelection ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change selected provider"
            onPress={onChangeSelection}
            style={[styles.changeButton, { borderColor: BRAND.primary }]}
          >
            <Text style={styles.changeButtonText}>Change</Text>
          </Pressable>
        ) : null}
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
                { color: isSelected ? BRAND.onPrimary : colors.text },
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
  billerName: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  changeButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  changeButtonText: {
    color: BRAND.primary,
    fontSize: 13,
    fontWeight: '700',
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
  selectedCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    padding: 14,
  },
  selectedCardMain: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  selectedCopy: {
    flex: 1,
    gap: 2,
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedLogo: {
    height: 32,
    width: 48,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
  },
});
