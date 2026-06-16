import Ionicons from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface OrderDetailsActionRowColors {
  border: string;
  text: string;
  textSecondary: string;
}

interface OrderDetailsActionRowProps {
  accessibilityLabel: string;
  accessoryIcon: IoniconsName;
  colors: OrderDetailsActionRowColors;
  description: string;
  icon: IoniconsName;
  iconColor: string;
  iconSurface: string;
  onPress: () => void;
  title: string;
  titleColor?: string;
}

export function OrderDetailsActionRow({
  accessibilityLabel,
  accessoryIcon,
  colors,
  description,
  icon,
  iconColor,
  iconSurface,
  onPress,
  title,
  titleColor,
}: OrderDetailsActionRowProps) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, { borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: iconSurface }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.actionCopy}>
        <Text
          style={[styles.actionTitle, { color: titleColor ?? colors.text }]}
        >
          {title}
        </Text>
        <Text
          style={[styles.actionDescription, { color: colors.textSecondary }]}
        >
          {description}
        </Text>
      </View>
      <Ionicons name={accessoryIcon} size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  actionCopy: {
    flex: 1,
  },
  actionDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  actionIconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
});
