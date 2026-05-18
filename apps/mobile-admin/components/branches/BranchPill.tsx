import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface BranchPillColors {
  border: string;
  card: string;
  primary: string;
  text: string;
  textOnPrimary: string;
}

interface BranchPillProps {
  icon: IoniconName;
  label: string;
  selected: boolean;
  colors: BranchPillColors;
  shadowStyle?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  accessibilityHint: string;
  onPress: () => void;
}

export function BranchPill({
  icon,
  label,
  selected,
  colors,
  shadowStyle,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: BranchPillProps) {
  const foregroundColor = selected ? colors.textOnPrimary : colors.primary;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.branchPill,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
        shadowStyle,
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
    >
      <Ionicons name={icon} size={14} color={foregroundColor} />
      <Text
        style={[
          styles.branchName,
          { color: selected ? colors.textOnPrimary : colors.text },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected && (
        <Ionicons
          name="checkmark-circle"
          size={14}
          color={colors.textOnPrimary}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
    maxWidth: 160,
    minHeight: 44,
  },
  branchName: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    flexShrink: 1,
  },
});
