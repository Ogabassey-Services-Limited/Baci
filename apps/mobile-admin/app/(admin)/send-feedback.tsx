/**
 * Send Feedback Screen
 * Allow users to rate and provide feedback on the app
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getRuntimePlatform } from '@/config/runtime-platform';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

const RATING_EMOJIS = ['😞', '😕', '😐', '🙂', '😍'];
const RATING_LABELS = ['Very Poor', 'Poor', 'Okay', 'Good', 'Excellent'];

const FEEDBACK_CATEGORIES = [
  {
    id: 'experience',
    label: 'App Experience',
    icon: 'phone-portrait-outline' as const,
  },
  { id: 'features', label: 'Features', icon: 'grid-outline' as const },
  {
    id: 'performance',
    label: 'Performance',
    icon: 'speedometer-outline' as const,
  },
  { id: 'design', label: 'Design', icon: 'color-palette-outline' as const },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' as const },
];

export default function SendFeedbackScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { merchant } = useMerchant();
  const { user } = useAuth();
  const router = useRouter();

  const [rating, setRating] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSubmit = async () => {
    if (rating === null) {
      Alert.alert(
        'Missing Rating',
        'Please select a rating for your experience.'
      );
      return;
    }

    setIsSending(true);

    // Real feedback submission to Supabase
    try {
      const { error: insertError } = await supabase.from('feedback').insert({
        merchant_id: merchant?.id,
        user_id: user?.id,
        rating: rating,
        categories: selectedCategories,
        message: message.trim() || null,
        platform: getRuntimePlatform(),
      });

      if (insertError) throw insertError;

      Alert.alert(
        'Thank You! 🎉',
        'Your feedback has been submitted. We appreciate you taking the time to help us improve!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Feedback submit error:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Send Feedback',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Rating Section */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              How would you rate your experience?
            </Text>
            <View style={styles.ratingContainer}>
              {RATING_EMOJIS.map((emoji, index) => (
                <Pressable
                  key={index}
                  style={[
                    styles.ratingButton,
                    {
                      backgroundColor:
                        rating === index + 1
                          ? `${colors.primary}20`
                          : colors.cardHover,
                      borderColor:
                        rating === index + 1 ? colors.primary : 'transparent',
                      borderWidth: rating === index + 1 ? 2 : 0,
                    },
                  ]}
                  onPress={() => setRating(index + 1)}
                >
                  <Text style={styles.ratingEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            {rating !== null && (
              <Text style={[styles.ratingLabel, { color: colors.primary }]}>
                {RATING_LABELS[rating - 1]}
              </Text>
            )}
          </View>

          {/* Categories */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              What would you like to give feedback on?
            </Text>
            <Text
              style={[styles.sectionSubtitle, { color: colors.textSecondary }]}
            >
              Select all that apply
            </Text>
            <View style={styles.categoriesGrid}>
              {FEEDBACK_CATEGORIES.map((category) => {
                const isSelected = selectedCategories.includes(category.id);
                return (
                  <Pressable
                    key={category.id}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : colors.cardHover,
                      },
                    ]}
                    onPress={() => toggleCategory(category.id)}
                  >
                    <Ionicons
                      name={category.icon}
                      size={16}
                      color={isSelected ? '#FFFFFF' : colors.text}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: isSelected ? '#FFFFFF' : colors.text },
                      ]}
                    >
                      {category.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Message Input */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Tell us more (optional)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.cardHover,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={message}
              onChangeText={setMessage}
              placeholder="What could we do better? Any features you'd love to see?"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Submit Button */}
          <Pressable
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary, opacity: isSending ? 0.7 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit Feedback</Text>
              </>
            )}
          </Pressable>

          {/* Footer */}
          <View style={styles.footer}>
            <Ionicons name="heart" size={16} color={colors.error} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Your feedback helps us improve Baci for everyone!
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.sm,
  },
  sectionSubtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.md,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  ratingButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingEmoji: { fontSize: 28 },
  ratingLabel: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginTop: SPACING.md,
  },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    gap: SPACING.xs,
  },
  categoryChipText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  footerText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});
