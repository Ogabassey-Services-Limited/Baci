import Ionicons from '@react-native-vector-icons/ionicons';
import { Text, View } from 'react-native';
import { getAddressLabelIcon } from '@/components/addresses/get-address-label-icon';
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
          backgroundColor: isDark ? colors.background : palette.gray[50],
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.summaryRow}>
        <View
          style={[
            styles.summaryChip,
            { backgroundColor: `${colors.textSecondary}10` },
          ]}
        >
          <Ionicons
            name={getAddressLabelIcon(selectedSavedAddress?.label)}
            size={22}
            color={BRAND.primary}
          />
        </View>
        <View style={styles.summaryBody}>
          <Text
            style={[styles.summaryMetaLabel, { color: colors.textSecondary }]}
          >
            {selectedSavedAddress?.is_default
              ? 'Default address'
              : 'Delivery destination'}
          </Text>
          <View style={styles.summaryTitleRow}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>
              {selectedSavedAddress?.label || 'Delivery address'}
            </Text>
            {selectedSavedAddress?.is_default ? (
              <View
                style={[
                  styles.savedAddressDefaultBadge,
                  { backgroundColor: BRAND.primaryAlpha12 },
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
      </View>
    </View>
  );
}
