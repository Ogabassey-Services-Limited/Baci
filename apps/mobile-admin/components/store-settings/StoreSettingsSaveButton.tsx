import { ActivityIndicator, Pressable, Text } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { storeSettingsStyles as styles } from './store-settings.styles';

interface StoreSettingsSaveButtonProps {
  colors: ThemeColors;
  isSaving: boolean;
  onPress: () => void;
}

/** Save button rendered in the store-settings header right slot. */
export function StoreSettingsSaveButton({
  colors,
  isSaving,
  onPress,
}: StoreSettingsSaveButtonProps) {
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
