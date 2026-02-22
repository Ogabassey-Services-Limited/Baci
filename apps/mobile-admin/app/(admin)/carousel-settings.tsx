import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SlideCard from '@/components/store-settings/SlideCard';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import {
  type HeroCarouselSlide,
  useHeroCarouselSettings,
} from '@/hooks/useHeroCarouselSettings';
import { useTheme } from '@/hooks/useTheme';

const MAX_SLIDES = 12;

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
  const { slides, isLoading, error, saveSlides, isSaving } =
    useHeroCarouselSettings();

  const [draftSlides, setDraftSlides] = useState<HeroCarouselSlide[]>([]);
  const isDraftInitialized = useRef(false);

  useEffect(() => {
    if (isLoading || isDraftInitialized.current) {
      return;
    }

    setDraftSlides(slides);
    isDraftInitialized.current = true;
  }, [isLoading, slides]);

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
    setDraftSlides((prev) =>
      prev.filter((_, slideIndex) => slideIndex !== index)
    );
  };

  const isAtSlideLimit = draftSlides.length >= MAX_SLIDES;

  const addSlide = () => {
    if (isSaving || isAtSlideLimit) return;
    setDraftSlides((prev) => [...prev, createEmptySlide(prev.length + 1)]);
  };

  const handleSave = async () => {
    try {
      const nonEmptySlides = draftSlides.filter(
        (slide) => slide.imageUrl.trim().length > 0
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
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centeredState}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Loading carousel settings...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.centeredState}>
          <Ionicons
            name="alert-circle-outline"
            color={colors.error}
            size={28}
          />
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            Failed to load carousel
          </Text>
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Please try again from Store Settings.
          </Text>
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
                <Text
                  style={[styles.headerSaveText, { color: colors.primary }]}
                >
                  Save
                </Text>
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
          <View
            style={[
              styles.infoCard,
              { backgroundColor: colors.card },
              shadows.sm,
            ]}
          >
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Mobile storefront only
            </Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              These slides are used by the mobile storefront app. Web carousel
              settings remain in the web dashboard.
            </Text>
          </View>

          {draftSlides.map((slide, index) => (
            <View
              key={slide.id || `${index}-${slide.headline}`}
              style={shadows.sm}
            >
              <SlideCard
                slide={slide}
                index={index}
                colors={colors}
                onChange={updateSlide}
                onRemove={removeSlide}
              />
            </View>
          ))}

          <Pressable
            accessibilityLabel="Add new slide"
            disabled={isSaving || isAtSlideLimit}
            style={[
              styles.addButton,
              {
                borderColor: colors.primary,
                opacity: isSaving || isAtSlideLimit ? 0.5 : 1,
              },
            ]}
            onPress={addSlide}
          >
            <Ionicons name="add" color={colors.primary} size={18} />
            <Text style={[styles.addButtonText, { color: colors.primary }]}>
              {isAtSlideLimit ? `Limit reached (${MAX_SLIDES})` : 'Add Slide'}
            </Text>
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
