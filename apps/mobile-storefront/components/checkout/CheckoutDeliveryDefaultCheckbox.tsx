import Ionicons from '@react-native-vector-icons/ionicons/static';
import { Pressable, Text, View } from 'react-native';
import { BRAND } from '@/constants/Colors';
import { checkoutDeliveryCardStyles as styles } from './CheckoutDeliveryCard.styles';
import type { CheckoutDeliveryCardColors } from './CheckoutDeliveryCard.types';

type CheckoutDeliveryDefaultCheckboxProps = {
  checked: boolean;
  colors: CheckoutDeliveryCardColors;
  label: string;
  onToggle: () => void;
};

export function CheckoutDeliveryDefaultCheckbox({
  checked,
  colors,
  label,
  onToggle,
}: CheckoutDeliveryDefaultCheckboxProps) {
  return (
    <View style={styles.saveDetailsSection}>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onToggle}
        style={styles.checkboxRow}
      >
        <View
          testID="checkout-delivery-default-checkbox-box"
          style={[
            styles.checkbox,
            checked && styles.checkboxChecked,
            {
              borderColor: checked ? BRAND.primary : colors.border,
            },
          ]}
        >
          {checked ? (
            <Ionicons
              name="checkmark"
              size={14}
              color="#FFFFFF"
              testID="checkout-delivery-default-checkbox-checkmark"
            />
          ) : null}
        </View>
        <Text style={[styles.checkboxLabel, { color: colors.text }]}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
