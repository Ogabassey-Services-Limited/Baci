import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, Text, View } from 'react-native';
import { checkoutScreenViewStyles as styles } from '../CheckoutScreenView.styles';
import type { ColorsScheme } from './LocationPickerColors';

interface PickerHeaderProps {
  colors: ColorsScheme;
  onClose: () => void;
  title: string;
}

export function PickerHeader({ colors, onClose, title }: PickerHeaderProps) {
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
