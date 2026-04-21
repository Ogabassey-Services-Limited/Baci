import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BRAND, RADIUS, SPACING, TYPOGRAPHY } from '@/constants/Colors';

export interface FAQSupportOption {
  accessibilityHint?: string;
  id: string;
  iconBackgroundColor?: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

interface FAQSupportGridProps {
  cardColor: string;
  defaultIconBackgroundColor: string;
  options: readonly FAQSupportOption[];
  secondaryTextColor: string;
  textColor: string;
}

export function FAQSupportGrid({
  cardColor,
  defaultIconBackgroundColor,
  options,
  secondaryTextColor,
  textColor,
}: FAQSupportGridProps) {
  return (
    <View style={styles.grid}>
      {options.map((option) => (
        <Pressable
          key={option.id}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: cardColor },
            pressed && styles.pressed,
          ]}
          onPress={option.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${option.title}, ${option.subtitle}`}
          accessibilityHint={option.accessibilityHint}
        >
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor:
                  option.iconBackgroundColor ?? defaultIconBackgroundColor,
              },
            ]}
          >
            <Ionicons
              name={option.icon}
              size={24}
              color={option.iconColor ?? BRAND.primary}
            />
          </View>
          <Text style={[styles.title, { color: textColor }]}>
            {option.title}
          </Text>
          <Text style={[styles.subtitle, { color: secondaryTextColor }]}>
            {option.subtitle}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  card: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
