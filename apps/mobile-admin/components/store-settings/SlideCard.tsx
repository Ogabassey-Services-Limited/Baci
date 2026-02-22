import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ThemeColors } from '@/constants/theme';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import type { HeroCarouselSlide } from '@/hooks/useHeroCarouselSettings';

interface SlideCardProps {
  slide: HeroCarouselSlide;
  index: number;
  colors: ThemeColors;
  onChange: (
    index: number,
    field: keyof HeroCarouselSlide,
    value: string
  ) => void;
  onRemove: (index: number) => void;
}

export default function SlideCard({
  slide,
  index,
  colors,
  onChange,
  onRemove,
}: SlideCardProps) {
  return (
    <View style={[styles.slideCard, { backgroundColor: colors.card }]}>
      <View style={styles.slideHeader}>
        <Text style={[styles.slideTitle, { color: colors.text }]}>
          Slide {index + 1}
        </Text>
        <Pressable
          accessibilityLabel={`Remove slide ${index + 1}`}
          accessibilityRole="button"
          onPress={() => onRemove(index)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </Pressable>
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Headline
      </Text>
      <TextInput
        accessibilityLabel={`Slide ${index + 1} Headline`}
        style={[
          styles.input,
          { borderColor: colors.border, color: colors.text },
        ]}
        value={slide.headline}
        onChangeText={(value) => onChange(index, 'headline', value)}
        placeholder="e.g. Laptops & Computing"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Description
      </Text>
      <TextInput
        accessibilityLabel={`Slide ${index + 1} Description`}
        style={[
          styles.input,
          { borderColor: colors.border, color: colors.text },
        ]}
        value={slide.description}
        onChangeText={(value) => onChange(index, 'description', value)}
        placeholder="e.g. Work machines and gaming rigs"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Image URL
      </Text>
      <TextInput
        accessibilityLabel={`Slide ${index + 1} Image URL`}
        style={[
          styles.input,
          { borderColor: colors.border, color: colors.text },
        ]}
        value={slide.imageUrl}
        onChangeText={(value) => onChange(index, 'imageUrl', value)}
        placeholder="https://..."
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Button Text
      </Text>
      <TextInput
        accessibilityLabel={`Slide ${index + 1} Button Text`}
        style={[
          styles.input,
          { borderColor: colors.border, color: colors.text },
        ]}
        value={slide.cta}
        onChangeText={(value) => onChange(index, 'cta', value)}
        placeholder="Shop Now"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Button Link
      </Text>
      <TextInput
        accessibilityLabel={`Slide ${index + 1} Button Link`}
        style={[
          styles.input,
          { borderColor: colors.border, color: colors.text },
        ]}
        value={slide.link}
        onChangeText={(value) => onChange(index, 'link', value)}
        placeholder="/category/all"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slideCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  slideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  slideTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  label: {
    fontSize: TYPOGRAPHY.size.xs,
    marginTop: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
