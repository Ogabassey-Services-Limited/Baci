import { Ionicons } from '@expo/vector-icons';
import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { ShippingAddressInput } from '@/lib/validation';
import { checkoutDeliveryCardStyles as styles } from './CheckoutDeliveryCard.styles';
import type { CheckoutDeliveryCardColors } from './CheckoutDeliveryCard.types';

type CheckoutDeliveryLocationPickerProps = {
  colors: CheckoutDeliveryCardColors;
  control: Control<ShippingAddressInput>;
  error?: string;
  isDark: boolean;
  isLoading: boolean;
  label: string;
  onPress: () => void;
  placeholder: string;
  valueName: 'city' | 'state';
};

export function CheckoutDeliveryLocationPicker({
  colors,
  control,
  error,
  isDark,
  isLoading,
  label,
  onPress,
  placeholder,
  valueName,
}: CheckoutDeliveryLocationPickerProps) {
  return (
    <View style={styles.halfInput}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Controller
        control={control}
        name={valueName}
        render={({ field: { value } }) => (
          <>
            <Pressable
              accessibilityLabel={`Select ${valueName}`}
              accessibilityRole="button"
              onPress={onPress}
              style={[
                styles.input,
                styles.selectInput,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.05)'
                    : '#F9FAFB',
                  borderColor: error ? '#EF4444' : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.selectInputText,
                  {
                    color: value ? colors.text : colors.textSecondary,
                  },
                ]}
              >
                {value || placeholder}
              </Text>
              {isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={colors.textSecondary}
                  testID={`checkout-delivery-${valueName}-loading`}
                />
              ) : (
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={colors.textSecondary}
                />
              )}
            </Pressable>
            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.fieldError}>
                {error}
              </Text>
            ) : null}
          </>
        )}
      />
    </View>
  );
}
