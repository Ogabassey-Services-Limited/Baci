import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND, palette } from '@/constants/Colors';
import { checkoutScreenViewStyles as styles } from '../CheckoutScreenView.styles';

export type ColorsScheme = (typeof Colors)['light'];

export function PickerHeader({
  colors,
  onClose,
  title,
}: {
  colors: ColorsScheme;
  onClose: () => void;
  title: string;
}) {
  return (
    <View style={styles.pickerHeader}>
      <Text style={[styles.pickerTitle, { color: colors.text }]}>{title}</Text>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Close ${title} picker`}
      >
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

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
