import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable } from 'react-native';
import { storeSettingsStyles as styles } from './store-settings.styles';

interface StoreSettingsBackButtonProps {
  color: string;
  onPress: () => void;
}

/** Navigation back button rendered in the store-settings header left slot. */
export function StoreSettingsBackButton({
  color,
  onPress,
}: StoreSettingsBackButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Back"
      accessibilityRole="button"
      onPress={onPress}
      style={styles.backButton}
    >
      <Ionicons name="arrow-back" size={24} color={color} />
    </Pressable>
  );
}
