import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  useHeroCarouselSettings,
  type HeroCarouselSlide,
} from '@/hooks/useHeroCarouselSettings';
import { useTheme } from '@/hooks/useTheme';

function createEmptySlide(index: number): HeroCarouselSlide {
  return {
    id: `slide-${Date.now()}-${index}`,
    imageUrl: '',
    headline: '',
    description: '',
    cta: 'Shop Now',
    link: '/category/all',
  };
}

export default function CarouselSettingsScreen() {
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const {
    slides,
    isLoading,
    error,
    saveSlides,
    isSaving,
  } = useHeroCarouselSettings();

  const [draftSlides, setDraftSlides] = useState<HeroCarouselSlide[]>([]);

  useEffect(() => {
    setDraftSlides(slides);
  }, [slides]);

  const updateSlide = (
    index: number,
    field: keyof HeroCarouselSlide,
    value: string
  ) => {
    setDraftSlides((prev) =>
      prev.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, [field]: value } : slide
      )
    );
  };

  const removeSlide = (index: number) => {
    setDraftSlides((prev) => prev.filter((_, slideIndex) => slideIndex !== index));
  };

  const addSlide = () => {
    setDraftSlides((prev) => [...prev, createEmptySlide(prev.length + 1)]);
  };

  const handleSave = async () => {
    try {
      const nonEmptySlides = draftSlides.filter(
        (slide) =>
          slide.headline.trim().length > 0 ||
          slide.description.trim().length > 0 ||
          slide.imageUrl.trim().length > 0
      );

      await saveSlides(nonEmptySlides);

      Alert.alert('Saved', 'Homepage carousel has been updated.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (saveError) {
      Alert.alert(
        'Save Failed',
        saveError instanceof Error
          ? saveError.message
          : 'Could not save carousel settings.'
      );
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centeredState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>Loading carousel settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centeredState}>
          <Ionicons name="alert-circle-outline" color={colors.error} size={28} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Failed to load carousel</Text>
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>Please try again from Store Settings.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Homepage Carousel',
          headerRight: () => (
            <Pressable
              disabled={isSaving}
              onPress={handleSave}
              style={styles.headerSaveButton}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Text style={[styles.headerSaveText, { color: colors.primary }]}>Save</Text>
              )}
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.infoCard, { backgroundColor: colors.card }, shadows.sm]}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Mobile storefront only</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              These slides are used by the mobile storefront app. Web carousel settings remain in the web dashboard.
            </Text>
          </View>

          {draftSlides.map((slide, index) => (
            <View
              key={slide.id || `${index}-${slide.headline}`}
              style={[styles.slideCard, { backgroundColor: colors.card }, shadows.sm]}
            >
              <View style={styles.slideHeader}>
                <Text style={[styles.slideTitle, { color: colors.text }]}>Slide {index + 1}</Text>
                <Pressable onPress={() => removeSlide(index)}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </Pressable>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Headline</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={slide.headline}
                onChangeText={(value) => updateSlide(index, 'headline', value)}
                placeholder="e.g. Laptops & Computing"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={slide.description}
                onChangeText={(value) => updateSlide(index, 'description', value)}
                placeholder="e.g. Work machines and gaming rigs"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Image URL</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={slide.imageUrl}
                onChangeText={(value) => updateSlide(index, 'imageUrl', value)}
                placeholder="https://..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Button Text</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={slide.cta}
                onChangeText={(value) => updateSlide(index, 'cta', value)}
                placeholder="Shop Now"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Button Link</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text }]}
                value={slide.link}
                onChangeText={(value) => updateSlide(index, 'link', value)}
                placeholder="/category/all"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
            </View>
          ))}

          <Pressable
            style={[styles.addButton, { borderColor: colors.primary }]}
            onPress={addSlide}
          >
            <Ionicons name="add" color={colors.primary} size={18} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Slide</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  stateTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  stateText: {
    fontSize: TYPOGRAPHY.size.sm,
    textAlign: 'center',
  },
  infoCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  infoTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  infoText: {
    fontSize: TYPOGRAPHY.size.sm,
  },
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
  addButton: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  addButtonText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  headerSaveButton: {
    minWidth: 56,
    alignItems: 'flex-end',
  },
  headerSaveText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
