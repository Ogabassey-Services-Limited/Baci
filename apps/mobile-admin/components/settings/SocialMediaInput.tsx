import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import {
  RADIUS,
  SPACING,
  type ThemeColors,
  TYPOGRAPHY,
} from '@/constants/theme';
import type { MerchantSocialMedia } from '@/hooks/useMerchant';

interface SocialMediaInputProps {
  platform: keyof MerchantSocialMedia;
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  colors: ThemeColors;
  badge?: string;
}

export default function SocialMediaInput({
  platform,
  label,
  icon,
  placeholder,
  value,
  onChange,
  colors,
  badge,
}: SocialMediaInputProps) {
  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors.textOnPrimary }]}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.inputContainer,
          {
            borderColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={colors.textMuted} />
        <TextInput
          accessibilityLabel={label}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
          testID={`${platform}-social-input`}
          value={value}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  badge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    height: '100%',
  },
});
