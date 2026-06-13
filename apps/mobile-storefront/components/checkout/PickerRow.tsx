import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, palette } from '@/constants/Colors';
import { checkoutScreenViewStyles as styles } from './CheckoutScreenView.styles';

type ColorsScheme = (typeof Colors)['light'];

export function PickerRow({
  colors,
  isDark,
  isSelected,
  item,
  onSelect,
}: {
  colors: ColorsScheme;
  isDark: boolean;
  isSelected: boolean;
  item: string;
  onSelect: (item: string) => void;
}) {
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
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.pickerItemText,
            {
              color: isSelected
                ? isDark
                  ? '#FDECEA'
                  : BRAND.primary
                : colors.text,
              fontWeight: isSelected ? '700' : '500',
              flex: 1,
            },
          ]}
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
