import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SPACING } from '@/constants/theme';

interface PasswordVisibilityToggleProps {
  accessibilityLabel: string;
  iconColor: string;
  iconName: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
}

export function PasswordVisibilityToggle({
  accessibilityLabel,
  iconColor,
  iconName,
  onPress,
}: PasswordVisibilityToggleProps) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.eyeButton}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={iconName} size={20} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyeButton: {
    padding: SPACING.xs,
  },
});
