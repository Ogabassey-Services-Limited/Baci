import Ionicons, { type IoniconsIconName } from "@react-native-vector-icons/ionicons/static";
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { getTransparentPrimaryColor } from './get-transparent-primary-color';

const PROMPT_SUGGESTIONS = [
  {
    icon: 'color-palette',
    label: 'Make it blue',
    prompt: 'Change the primary color to blue',
  },
  {
    icon: 'add-circle',
    label: 'Add testimonials',
    prompt: 'Add a testimonials section with customer reviews',
  },
  {
    icon: 'sparkles',
    label: 'Make it festive',
    prompt: 'Add festive red and gold colors for the holiday season',
  },
  {
    icon: 'text',
    label: 'Update hero text',
    prompt: 'Change the hero title to "Welcome to our store"',
  },
] as const;

interface CustomizeWelcomeStateProps {
  colors: ThemeColors;
  onSuggestionSelect: (prompt: string) => void;
}

export function CustomizeWelcomeState({
  colors,
  onSuggestionSelect,
}: CustomizeWelcomeStateProps) {
  return (
    <View style={styles.welcomeContainer}>
      <View
        style={[
          styles.welcomeIcon,
          {
            backgroundColor: getTransparentPrimaryColor(
              colors.primaryLight,
              colors.primary
            ),
          },
        ]}
      >
        <Ionicons name="sparkles" size={40} color={colors.primary} />
      </View>
      <Text style={[styles.welcomeTitle, { color: colors.text }]}>
        Hi! I&apos;m your AI Copilot
      </Text>
      <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
        Tell me how you&apos;d like to customize your store. I can change
        colors, add sections, update content, and more.
      </Text>

      <View style={styles.suggestionsContainer}>
        {PROMPT_SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion.prompt}
            accessibilityLabel={`Use suggestion: ${suggestion.label}`}
            accessibilityRole="button"
            onPress={() => onSuggestionSelect(suggestion.prompt)}
            style={({ pressed }) => [
              styles.suggestionChip,
              {
                backgroundColor: pressed
                  ? (colors.primaryLight ?? colors.cardHover ?? colors.card)
                  : colors.card,
              },
            ]}
          >
            <Ionicons
              name={suggestion.icon as IoniconsIconName}
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.suggestionText, { color: colors.text }]}>
              {suggestion.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: SPACING['2xl'],
  },
  welcomeIcon: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    height: 72,
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    width: 72,
  },
  welcomeTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.size['3xl'],
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.md,
    lineHeight: 22,
    marginTop: SPACING.md,
    maxWidth: 320,
    textAlign: 'center',
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'center',
    marginTop: SPACING['2xl'],
  },
  suggestionChip: {
    alignItems: 'center',
    borderRadius: RADIUS.full,
    flexDirection: 'row',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  suggestionText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
