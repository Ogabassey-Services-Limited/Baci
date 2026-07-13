import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, View } from 'react-native';
import { styles } from './styles';
import type { TaxCardShadow, TaxColors } from './types';

interface TaxRegionUnavailableCardProps {
  colors: TaxColors;
  shadowStyle: TaxCardShadow;
}

/**
 * Shown instead of the Nigeria-specific tax form (VAT/TIN/FIRS address) when
 * the merchant's country isn't Nigeria. Tax settings are a Nigeria-only
 * FIRS feature by design — this is an informational stand-in, not a partial
 * multi-country tax implementation.
 */
export function TaxRegionUnavailableCard({
  colors,
  shadowStyle,
}: TaxRegionUnavailableCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <View style={styles.cardHeader}>
        <View
          style={[styles.iconContainer, { backgroundColor: colors.cardHover }]}
        >
          <Ionicons
            name="globe-outline"
            size={24}
            color={colors.textSecondary}
          />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Tax settings unavailable
          </Text>
        </View>
      </View>
      <Text style={[styles.toggleDescription, { color: colors.textSecondary }]}>
        Tax settings are currently available for Nigerian merchants only —
        support for your region is coming.
      </Text>
    </View>
  );
}
