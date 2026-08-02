import { Pressable, Text, View } from 'react-native';
import type { ThemeColors, ThemeShadows } from '@/constants/theme';
import type { AnalyticsState } from '@/lib/analytics-config-diff';
import { analyticsConfigStyles as styles } from './analytics-config.styles';

interface OfflineConversionsCardProps {
  colors: ThemeColors;
  enabled: boolean;
  shadows: ThemeShadows;
  onChange: (field: keyof AnalyticsState, value: boolean) => void;
}

export function OfflineConversionsCard({
  colors,
  enabled,
  onChange,
  shadows,
}: OfflineConversionsCardProps) {
  return (
    <View
      style={[styles.toggleCard, { backgroundColor: colors.card }, shadows.sm]}
    >
      <View style={styles.toggleContent}>
        <View style={styles.toggleInfo}>
          <Text style={[styles.toggleTitle, { color: colors.text }]}>
            Auto-Upload Conversions
          </Text>
          <Text
            style={[styles.toggleSubtitle, { color: colors.textSecondary }]}
          >
            Automatically send orders to ad platforms when payments are
            confirmed
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Auto-upload conversions"
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
          style={[
            styles.toggle,
            { backgroundColor: enabled ? colors.primary : colors.border },
          ]}
          onPress={() => onChange('offline_conversions_enabled', !enabled)}
        >
          <View
            testID="offline-conversions-toggle-knob"
            style={[
              styles.toggleKnob,
              {
                backgroundColor: colors.textOnPrimary,
                transform: [{ translateX: enabled ? 20 : 2 }],
              },
            ]}
          />
        </Pressable>
      </View>
    </View>
  );
}
