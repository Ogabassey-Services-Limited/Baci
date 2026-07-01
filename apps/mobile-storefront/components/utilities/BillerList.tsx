import Ionicons from '@react-native-vector-icons/ionicons';
import {
  ActivityIndicator,
  Image,
  type ImageStyle,
  Pressable,
  type StyleProp,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { BillerInitial } from '@/components/utilities/BillerInitial';
import Colors, { BRAND } from '@/constants/Colors';
import type { Biller } from '@/hooks/use-vtu-billers';
import { billerListStyles as styles } from './biller-list.styles';

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
          Loading providers…
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

  // Entry state with beneficiaries: the grid is hidden behind a single tappable
  // "Other providers" row so the beneficiary list owns the screen. Only expose
  // the button when there's a handler to open the grid (mirrors the sibling
  // collapsed path).
  if (isCollapsed && !selectedBiller && onChangeSelection) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Show other providers"
        onPress={onChangeSelection}
        style={[
          styles.otherProvidersRow,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.otherProvidersText, { color: colors.text }]}>
          Other providers
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>
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
