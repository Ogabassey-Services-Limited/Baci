import {
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';

interface StoreUrlSectionProps {
  colors: ThemeColors;
  onSlugChange: (text: string) => void;
  shadowStyle: StyleProp<ViewStyle>;
  slug: string;
  slugLocked: boolean;
}

export function StoreUrlSection({
  colors,
  onSlugChange,
  shadowStyle,
  slug,
  slugLocked,
}: StoreUrlSectionProps) {
  const helperMessage = slugLocked
    ? 'Store links are locked after setup. Contact support if you need a change.'
    : 'This is your unique store link. Changing it will break existing links.';

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, shadowStyle]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Store URL
      </Text>
      <View
        style={[
          styles.urlContainer,
          { backgroundColor: colors.cardHover ?? colors.background },
        ]}
      >
        <TextInput
          accessibilityHint={helperMessage}
          accessibilityLabel="Store slug"
          autoCapitalize="none"
          editable={!slugLocked}
          onChangeText={onSlugChange}
          placeholder="your-store-name"
          placeholderTextColor={colors.textMuted}
          selectTextOnFocus={!slugLocked}
          style={[
            styles.urlInput,
            slugLocked && styles.lockedUrlInput,
            { color: slugLocked ? colors.textSecondary : colors.text },
          ]}
          value={slug}
        />
        <Text style={[styles.urlSuffix, { color: colors.textSecondary }]}>
          .usebaci.com
        </Text>
      </View>
      <Text style={[styles.helperText, { color: colors.textSecondary }]}>
        {helperMessage}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  label: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
    marginBottom: SPACING.sm,
  },
  urlContainer: {
    alignItems: 'center',
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    padding: SPACING.md,
  },
  urlInput: {
    flex: 1,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
    padding: 0,
  },
  lockedUrlInput: {
    opacity: 0.7,
  },
  urlSuffix: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.md,
  },
  helperText: {
    fontSize: TYPOGRAPHY.size.sm,
    marginTop: SPACING.sm,
  },
});
