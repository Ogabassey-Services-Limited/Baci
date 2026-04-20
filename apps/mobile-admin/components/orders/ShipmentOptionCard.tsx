import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { styles } from './ShipmentFlowSheet.styles';

interface ShipmentOptionCardProps {
  colors: ThemeColors;
  description: string;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  selected: boolean;
  title: string;
}

export function ShipmentOptionCard({
  colors,
  description,
  disabled = false,
  icon,
  onPress,
  selected,
  title,
}: ShipmentOptionCardProps) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${description}`}
      accessibilityRole="radio"
      accessibilityState={{ disabled, checked: selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.optionCard,
        {
          backgroundColor: selected ? colors.primaryLight : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.48 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.optionIconWrap,
          {
            backgroundColor: selected
              ? colors.primaryLight
              : colors.backgroundLight,
          },
        ]}
      >
        <Ionicons
          color={selected ? colors.primary : colors.textSecondary}
          name={icon}
          size={18}
        />
      </View>
      <View style={styles.optionCopy}>
        <Text style={[styles.optionTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text
          style={[styles.optionDescription, { color: colors.textSecondary }]}
        >
          {description}
        </Text>
      </View>
      <Ionicons
        color={selected ? colors.primary : colors.textMuted}
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
      />
    </Pressable>
  );
}
