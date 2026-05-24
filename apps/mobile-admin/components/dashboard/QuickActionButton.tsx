import Ionicons, { type IoniconsIconName } from "@react-native-vector-icons/ionicons/static";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface QuickActionButtonProps {
  icon: IoniconsIconName;
  label: string;
  onPress: () => void;
  iconColor?: string;
  backgroundColor?: string;
}

export function QuickActionButton({
  icon,
  label,
  onPress,
  iconColor,
  backgroundColor,
}: QuickActionButtonProps) {
  const { colors, shadows } = useTheme();
  const finalIconColor = iconColor || colors.primary;
  const finalBgColor = backgroundColor || colors.primaryLight;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.card },
        shadows.sm,
        pressed && { backgroundColor: colors.cardHover },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.iconContainer, { backgroundColor: finalBgColor }]}>
        <Ionicons name={icon} size={24} color={finalIconColor} />
      </View>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    textAlign: 'center',
  },
});
