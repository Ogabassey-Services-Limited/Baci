import Ionicons from '@react-native-vector-icons/ionicons';
import { Pressable, StyleSheet } from 'react-native';
import { SPACING } from '@/constants/theme';
import type { ThemeColors, ThemeShadows } from './types';

interface CreateOrderFabProps {
  colors: ThemeColors;
  shadows: ThemeShadows;
  onPress: () => void;
}

export const CREATE_ORDER_FAB_BOTTOM_OFFSET = 125;
export const CREATE_ORDER_FAB_Z_INDEX = 300;

export function CreateOrderFab({
  colors,
  shadows,
  onPress,
}: CreateOrderFabProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.gold,
          position: 'absolute',
          bottom: CREATE_ORDER_FAB_BOTTOM_OFFSET,
          zIndex: CREATE_ORDER_FAB_Z_INDEX,
        },
        shadows.lg,
        pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] },
      ]}
      onPress={onPress}
      accessibilityLabel="Create new order"
      accessibilityRole="button"
      accessibilityHint="Opens form to create a new order"
    >
      <Ionicons name="add" size={28} color={colors.textOnGold} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
