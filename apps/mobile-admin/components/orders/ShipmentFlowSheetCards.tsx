import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { styles } from './ShipmentFlowSheet.styles';

export function ShipmentField({
  children,
  colors,
  label,
  required = false,
  value,
  withInnerPadding = true,
}: {
  children: ReactNode;
  colors: ThemeColors;
  label: string;
  required?: boolean;
  value: string;
  withInnerPadding?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {label}
        {required ? ' *' : ''}
      </Text>
      <View
        style={[
          styles.fieldInputWrap,
          withInnerPadding ? styles.fieldInputWrapPadded : null,
          {
            backgroundColor: colors.backgroundLight,
            borderColor: value.trim() ? `${colors.primary}55` : colors.border,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function ShipmentInfoCard({
  colors,
  icon,
  subtitle,
  title,
}: {
  colors: ThemeColors;
  icon: keyof typeof Ionicons.glyphMap;
  subtitle: string;
  title: string;
}) {
  return (
    <View style={[styles.infoCard, { backgroundColor: `${colors.primary}10` }]}>
      <View
        style={[
          styles.infoIconWrap,
          { backgroundColor: `${colors.primary}18` },
        ]}
      >
        <Ionicons color={colors.primary} name={icon} size={18} />
      </View>
      <View style={styles.infoCopy}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.infoSubtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export function ShipmentOptionCard({
  colors,
  description,
  disabled = false,
  icon,
  onPress,
  selected,
  title,
}: {
  colors: ThemeColors;
  description: string;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  selected: boolean;
  title: string;
}) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${description}`}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.optionCard,
        {
          backgroundColor: selected ? `${colors.primary}10` : colors.card,
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
              ? `${colors.primary}18`
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
