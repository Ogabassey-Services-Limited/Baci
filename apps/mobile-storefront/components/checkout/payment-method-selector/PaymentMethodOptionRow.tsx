import Ionicons from '@react-native-vector-icons/ionicons';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { paymentMethodSelectorStyles as styles } from './styles';
import type { PaymentMethod } from './types';

type ThemeColors = (typeof Colors)['light'];

interface PaymentMethodOptionRowProps {
  colors: ThemeColors;
  isDisabled: boolean;
  isSelected: boolean;
  method: PaymentMethod;
  onPress: (methodId: PaymentMethod['id']) => void;
  overrideBadge?: string;
  overrideDescription?: string;
  overrideLabel?: string;
  /**
   * Rendered inside an already-framed intent card (the accordion). Drops the red
   * selected border for a subtle tint so we don't nest a red box in a red box.
   */
  nested?: boolean;
}

export function PaymentMethodOptionRow({
  colors,
  isDisabled,
  isSelected,
  method,
  onPress,
  overrideBadge,
  overrideDescription,
  overrideLabel,
  nested = false,
}: PaymentMethodOptionRowProps) {
  const methodBadge = overrideBadge;
  const methodDescription = overrideDescription ?? method.description;
  const methodLabel = overrideLabel ?? method.label;

  return (
    <Pressable
      style={[
        styles.methodCard,
        {
          backgroundColor:
            isSelected && nested ? BRAND.primaryAlpha06 : colors.card,
          borderColor:
            isSelected && !nested ? BRAND.primary : colors.border,
          opacity: isDisabled ? 0.5 : 1,
        },
      ]}
      onPress={() => !isDisabled && onPress(method.id)}
      disabled={isDisabled}
      accessibilityRole="radio"
      accessibilityState={{
        checked: isSelected,
        disabled: isDisabled,
      }}
      accessibilityLabel={`${methodLabel}. ${isDisabled ? method.disabledReason : methodDescription}`}
    >
      <View
        style={[
          styles.methodIconContainer,
          { backgroundColor: `${colors.textSecondary}10` },
        ]}
      >
        {method.logoUrl ? (
          <Image
            source={method.logoUrl}
            style={styles.methodLogo}
            contentFit="contain"
          />
        ) : (
          <Ionicons
            name={method.icon}
            size={24}
            color={isSelected ? colors.text : colors.textSecondary}
          />
        )}
      </View>

      <View style={styles.methodInfo}>
        <View style={styles.methodTitleRow}>
          <Text style={[styles.methodLabel, { color: colors.text }]}>
            {methodLabel}
          </Text>
          {methodBadge ? (
            <View style={styles.methodBadge}>
              <Text style={styles.methodBadgeText}>{methodBadge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
          {isDisabled ? method.disabledReason : methodDescription}
        </Text>
      </View>

      <View
        style={[
          styles.radioOuter,
          { borderColor: isSelected ? BRAND.primary : colors.border },
        ]}
      >
        {isSelected ? (
          <View
            style={[styles.radioInner, { backgroundColor: BRAND.primary }]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
