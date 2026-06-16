import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import { BRAND, palette } from '@/constants/Colors';
import { checkoutScreenViewStyles as styles } from '../CheckoutScreenView.styles';
import type { ColorsScheme } from './LocationPickerColors';

interface PickerRowProps {
  colors: ColorsScheme;
  isDark: boolean;
  isSelected: boolean;
  item: string;
  onSelect: (item: string) => void;
}

export function PickerRow({
  colors,
  isDark,
  isSelected,
  item,
  onSelect,
}: PickerRowProps) {
  return (
    <Pressable
      style={[
        styles.pickerItem,
        { borderBottomColor: colors.border },
        isSelected && {
          backgroundColor: isDark ? 'rgba(217, 59, 48, 0.14)' : palette.red[50],
        },
      ]}
      onPress={() => onSelect(item)}
    >
      <View style={styles.pickerItemContent}>
        <Text
          style={[
            styles.pickerItemText,
            {
              color: isSelected
                ? isDark
                  ? '#FDECEA'
                  : BRAND.primary
                : colors.text,
              fontWeight: isSelected ? '700' : '500',
            },
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark" size={18} color={BRAND.primary} />
        )}
      </View>
    </Pressable>
  );
}
