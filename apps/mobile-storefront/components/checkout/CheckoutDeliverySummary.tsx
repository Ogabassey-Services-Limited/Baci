import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { BRAND, palette } from '@/constants/Colors';
import type { SavedAddress } from '@/lib/checkout-saved-address';
import { checkoutDeliveryCardStyles as styles } from './CheckoutDeliveryCard.styles';
import type { CheckoutDeliveryCardColors } from './CheckoutDeliveryCard.types';

type CheckoutDeliverySummaryProps = {
  colors: CheckoutDeliveryCardColors;
  currentDeliverySummary: string;
  isDark: boolean;
  selectedSavedAddress: SavedAddress | null;
};

export function CheckoutDeliverySummary({
  colors,
  currentDeliverySummary,
  isDark,
  selectedSavedAddress,
}: CheckoutDeliverySummaryProps) {
  return (
    <View
      style={[
        styles.summaryPanel,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.04)'
            : palette.gray[50],
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.summaryMetaRow}>
        <Ionicons
          name="navigate-circle-outline"
          size={16}
          color={BRAND.primary}
        />
        <Text
          style={[styles.summaryMetaLabel, { color: colors.textSecondary }]}
        >
          {selectedSavedAddress?.is_default
            ? 'Default address'
            : 'Delivery destination'}
        </Text>
      </View>
      <View style={styles.summaryTitleRow}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>
          {selectedSavedAddress?.label || 'Delivery address'}
        </Text>
        {selectedSavedAddress?.is_default ? (
          <View
            style={[
              styles.savedAddressDefaultBadge,
              { backgroundColor: `${BRAND.primary}14` },
            ]}
          >
            <Text
              style={[
                styles.savedAddressDefaultBadgeText,
                { color: BRAND.primary },
              ]}
            >
              Default
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.summaryLine, { color: colors.textSecondary }]}>
        {currentDeliverySummary || 'No delivery address selected yet'}
      </Text>
    </View>
  );
}
