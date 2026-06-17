import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { storeSettingsStyles as styles } from './store-settings.styles';

interface BackButtonProps {
  color: string;
  onPress: () => void;
}

/** Navigation back button rendered in the store-settings header (left slot). */
export function StoreSettingsBackButton({ color, onPress }: BackButtonProps) {
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

interface SaveButtonProps {
  colors: ThemeColors;
  isSaving: boolean;
  onPress: () => void;
}

/** Save button rendered in the store-settings header (right slot). */
export function StoreSettingsSaveButton({
  colors,
  isSaving,
  onPress,
}: SaveButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Save store settings"
      accessibilityRole="button"
      onPress={onPress}
      disabled={isSaving}
      style={styles.saveButton}
    >
      {isSaving ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
      )}
    </Pressable>
  );
}
