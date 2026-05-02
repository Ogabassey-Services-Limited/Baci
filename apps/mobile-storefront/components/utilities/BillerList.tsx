import {
  ActivityIndicator,
  Image,
  type ImageStyle,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { BillerInitial } from '@/components/utilities/BillerInitial';
import Colors, { BRAND, SPACING } from '@/constants/Colors';
import type { Biller } from '@/hooks/use-vtu-billers';

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

interface BillerLogoProps {
  biller: Biller | null;
  colors: typeof Colors.light;
  imageStyle: StyleProp<ImageStyle>;
  initialStyle?: StyleProp<ViewStyle>;
}

function BillerLogo({
  biller,
  colors,
  imageStyle,
  initialStyle,
}: BillerLogoProps) {
  if (!biller) {
    return null;
  }

  if (biller?.billerIconUrl) {
    return (
      <Image
        accessibilityLabel={`${biller.billerName} logo`}
        accessibilityRole="image"
        source={{ uri: biller.billerIconUrl }}
        style={imageStyle}
        resizeMode="contain"
      />
    );
  }

  return (
    <BillerInitial
      name={biller?.billerName ?? ''}
      colors={colors}
      style={initialStyle}
    />
  );
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

  if (isCollapsed) {
    const hasSelectedBiller = Boolean(selectedBiller);
    const selectedName = selectedBiller?.billerName ?? 'Select provider';
    const actionLabel = hasSelectedBiller ? 'Change' : 'Select';
    const actionAccessibilityLabel = hasSelectedBiller
      ? 'Change selected provider'
      : 'Select provider';

    return (
      <View
        style={[
          styles.selectedCard,
          {
            backgroundColor: hasSelectedBiller
              ? BRAND.primaryAlpha06
              : colors.card,
            borderColor: hasSelectedBiller ? BRAND.primary : colors.border,
          },
        ]}
      >
        <View style={styles.selectedCardMain}>
          <BillerLogo
            biller={selectedBiller}
            colors={colors}
            imageStyle={styles.selectedLogo}
            initialStyle={styles.selectedInitial}
          />
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
              {selectedName}
            </Text>
          </View>
        </View>
        {onChangeSelection ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionAccessibilityLabel}
            onPress={onChangeSelection}
            style={[styles.changeButton, { borderColor: BRAND.primary }]}
          >
            <Text style={styles.changeButtonText}>{actionLabel}</Text>
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
            <BillerLogo
              biller={biller}
              colors={colors}
              imageStyle={styles.logo}
              initialStyle={styles.initialSpacing}
            />
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
  initialSpacing: {
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
  selectedInitial: {
    height: 32,
    width: 32,
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
  },
});
