import Ionicons from '@react-native-vector-icons/ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface ProductsListEmptyProps {
  buttonHint?: string;
  buttonLabel?: string | null;
  description?: string;
  icon: IoniconName;
  onButtonPress?: (() => void) | null;
  showButtonIcon?: boolean;
  title: string;
}

export function ProductsListEmpty({
  buttonHint,
  buttonLabel,
  description,
  icon,
  onButtonPress,
  showButtonIcon = true,
  title,
}: ProductsListEmptyProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={56} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {description ? (
        <Text style={[styles.text, { color: colors.textSecondary }]}>
          {description}
        </Text>
      ) : null}
      {buttonLabel && onButtonPress ? (
        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.gold, minHeight: 44 },
          ]}
          onPress={onButtonPress}
          accessibilityLabel={buttonLabel}
          accessibilityRole="button"
          accessibilityHint={buttonHint}
        >
          {showButtonIcon ? (
            <Ionicons name="add" size={20} color={colors.textOnPrimary} />
          ) : null}
          <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
            {buttonLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  buttonText: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  container: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  text: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.lg,
    marginTop: SPACING.md,
  },
});
