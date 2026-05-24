import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { BRAND, palette } from '@/constants/Colors';
import { checkoutDeliveryCardStyles as styles } from './CheckoutDeliveryCard.styles';
import type { CheckoutDeliveryCardColors } from './CheckoutDeliveryCard.types';

type CheckoutDeliveryNewAddressIntroProps = {
  colors: CheckoutDeliveryCardColors;
  isDark: boolean;
};

export function CheckoutDeliveryNewAddressIntro({
  colors,
  isDark,
}: CheckoutDeliveryNewAddressIntroProps) {
  return (
    <View
      testID="checkout-delivery-new-address-intro"
      style={[
        styles.newAddressIntro,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.04)'
            : palette.gray[50],
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons
        name="sparkles-outline"
        size={18}
        color={BRAND.primary}
        testID="checkout-delivery-new-address-icon"
      />
      <View style={styles.newAddressIntroBody}>
        <Text style={[styles.newAddressIntroTitle, { color: colors.text }]}>
          New delivery address
        </Text>
        <Text
          style={[styles.newAddressIntroText, { color: colors.textSecondary }]}
        >
          Use this if this order should go somewhere else.
        </Text>
      </View>
    </View>
  );
}
