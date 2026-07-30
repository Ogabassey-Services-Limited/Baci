import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { storeSettingsStyles as styles } from './store-settings.styles';

interface StoreSettingsLoadErrorProps {
  colors: ThemeColors;
  onRetry: () => void;
}

export function StoreSettingsLoadError({
  colors,
  onRetry,
}: StoreSettingsLoadErrorProps) {
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        accessibilityRole="alert"
        style={[styles.card, { backgroundColor: colors.card }]}
      >
        <Text style={[styles.label, { color: colors.text }]}>
          Couldn't load store settings. Please try again.
        </Text>
        <Pressable
          accessibilityLabel="Retry loading store settings"
          accessibilityRole="button"
          onPress={onRetry}
        >
          <Text style={{ color: colors.primary }}>Retry</Text>
        </Pressable>
      </View>
    </View>
  );
}
