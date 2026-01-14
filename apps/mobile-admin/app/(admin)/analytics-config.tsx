/**
 * Analytics Configuration Screen
 * Manage Google Analytics and Pixel IDs
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

export default function AnalyticsConfigScreen() {
  const { colors, shadows } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  // State for analytics
  const [analytics, setAnalytics] = useState({
    google: '',
    meta: '',
    tiktok: '',
  });

  // Fetch merchant data
  const { data: merchant, isLoading } = useQuery({
    queryKey: ['merchant-analytics', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select('google_analytics_id, facebook_pixel_id, tiktok_pixel_id')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Populate state
  useEffect(() => {
    if (merchant) {
      setAnalytics({
        google: merchant.google_analytics_id || '',
        meta: merchant.facebook_pixel_id || '',
        tiktok: merchant.tiktok_pixel_id || '',
      });
    }
  }, [merchant]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('merchants')
        .update({
          google_analytics_id: analytics.google || null,
          facebook_pixel_id: analytics.meta || null,
          tiktok_pixel_id: analytics.tiktok || null,
        })
        .eq('user_id', user!.id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      queryClient.invalidateQueries({ queryKey: ['store-readiness'] });
      Alert.alert('Success', 'Tracking IDs updated', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Analytics & Tracking',
          /* Native back button */
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={saveMutation.isPending}
              style={styles.saveButton}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveText, { color: colors.primary }]}>
                  Save
                </Text>
              )}
            </Pressable>
          ),
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          // headerBackTitleVisible: false,
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
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name="bar-chart"
                size={24}
                color={colors.primary}
                style={styles.cardIcon}
              />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Tracking Codes
              </Text>
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Add your pixel and tracking IDs to track visitors and conversion
              events.
            </Text>

            {/* Google Analytics */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Google Analytics ID (G-XXXX)
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Ionicons
                  name="logo-google"
                  size={20}
                  color={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={analytics.google}
                  onChangeText={(t) =>
                    setAnalytics((p) => ({ ...p, google: t }))
                  }
                  placeholder="G-XXXXXXXXXX"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Meta Pixel */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Meta Pixel ID
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Ionicons
                  name="logo-facebook"
                  size={20}
                  color={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={analytics.meta}
                  onChangeText={(t) => setAnalytics((p) => ({ ...p, meta: t }))}
                  placeholder="1234567890"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* TikTok Pixel */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                TikTok Pixel ID
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Ionicons
                  name="logo-tiktok"
                  size={20}
                  color={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={analytics.tiktok}
                  onChangeText={(t) =>
                    setAnalytics((p) => ({ ...p, tiktok: t }))
                  }
                  placeholder="AABBCC112233"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  backButton: {}, // Native handles padding
  saveButton: {},
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  cardIcon: {
    marginBottom: 2, // optical alignment
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.xl,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
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
