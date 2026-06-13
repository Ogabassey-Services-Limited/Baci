import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { checkoutScreenViewStyles as styles } from './CheckoutScreenView.styles';

type ColorsScheme = (typeof Colors)['light'];

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
