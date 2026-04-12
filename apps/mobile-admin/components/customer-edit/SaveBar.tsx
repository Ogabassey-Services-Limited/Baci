import { ActivityIndicator, Pressable, Text } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { customerEditStyles as styles } from '@/components/customer-edit/customer-edit.styles';
import type {
  CustomerEditShadows,
  CustomerEditThemeColors,
} from '@/components/customer-edit/customer-edit.types';

interface SaveBarProps {
  colors: CustomerEditThemeColors;
  isSaving: boolean;
  onSave: () => void;
  shadows: CustomerEditShadows;
}

export function SaveBar({ colors, isSaving, onSave, shadows }: SaveBarProps) {
  return (
    <Animated.View
      entering={FadeInUp.delay(500).duration(500)}
      style={styles.buttonContainer}
    >
      <Pressable
        disabled={isSaving}
        onPress={onSave}
        style={[
          styles.saveButton,
          { backgroundColor: colors.primary },
          shadows.md,
        ]}
      >
        {isSaving ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
