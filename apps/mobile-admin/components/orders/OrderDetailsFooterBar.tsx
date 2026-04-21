import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ThemeColors } from '@/constants/theme';

interface OrderDetailsFooterBarProps {
  colors: ThemeColors;
  currentStatusLabel: string;
  statusColor: string;
  onPress: () => void;
}

export function OrderDetailsFooterBar({
  colors,
  currentStatusLabel,
  onPress,
  statusColor,
}: OrderDetailsFooterBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: 24 + insets.bottom,
        },
      ]}
    >
      <View style={styles.content}>
        <View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Current Status
          </Text>
          <Text style={[styles.status, { color: statusColor }]}>
            {currentStatusLabel}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Update order status"
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={onPress}
        >
          <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
            Update Status
          </Text>
          <Ionicons
            accessibilityElementsHidden
            importantForAccessibility="no"
            name="chevron-up"
            size={16}
            color={colors.textOnPrimary}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footer: {
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  label: {
    fontSize: 12,
  },
  status: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
});
