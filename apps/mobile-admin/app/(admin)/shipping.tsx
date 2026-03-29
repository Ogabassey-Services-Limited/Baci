/**
 * Shipping Settings Screen
 * Configure shipping providers and delivery settings
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProvidersList } from '@/components/shipping/ProvidersList';
import { ShippingForm } from '@/components/shipping/ShippingForm';
import { styles } from '@/components/shipping/shipping-styles';
import type { ShippingSettings } from '@/components/shipping/shipping-types';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

export default function ShippingScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const screenOptions = {
    title: 'Shipping',
    headerLeft: () => (
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </Pressable>
    ),
  };

  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [tempThreshold, setTempThreshold] = useState('');

  // Fetch shipping settings
  const {
    data: settings,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['shipping-settings', user?.id],
    queryFn: async () => {
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (merchantError) throw merchantError;
      if (!merchant) throw new Error('No merchant found');

      const { data, error } = await supabase
        .from('merchant_feature_settings')
        .select('merchant_id, shipping_providers, free_shipping_threshold')
        .eq('merchant_id', merchant.id)
        .single();

      if (error) throw error;
      return data as ShippingSettings;
    },
    enabled: !!user?.id,
  });

  // Toggle provider mutation
  const toggleProviderMutation = useMutation({
    mutationFn: async ({
      providerId,
      enabled,
    }: {
      providerId: string;
      enabled: boolean;
    }) => {
      if (!settings?.merchant_id) throw new Error('No settings found');

      const currentProviders = settings.shipping_providers || [];
      let newProviders: string[];

      if (enabled) {
        newProviders = [...currentProviders, providerId];
      } else {
        newProviders = currentProviders.filter((p) => p !== providerId);
      }

      const { error } = await supabase
        .from('merchant_feature_settings')
        .update({ shipping_providers: newProviders })
        .eq('merchant_id', settings.merchant_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-settings'] });
    },
    onError: (_error: unknown) => {
      Alert.alert('Error', 'Failed to update shipping provider');
    },
  });

  // Update threshold mutation
  const updateThresholdMutation = useMutation({
    mutationFn: async (threshold: number | null) => {
      if (!settings?.merchant_id) throw new Error('No settings found');

      const { error } = await supabase
        .from('merchant_feature_settings')
        .update({ free_shipping_threshold: threshold })
        .eq('merchant_id', settings.merchant_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-settings'] });
      setIsEditingThreshold(false);
    },
    onError: (_error: unknown) => {
      Alert.alert('Error', 'Failed to update free shipping threshold');
    },
  });

  const handleManageShipping = () => {
    Linking.openURL('https://usebaci.com/dashboard/settings/shipping');
  };

  const isProviderEnabled = (providerId: string) => {
    return settings?.shipping_providers?.includes(providerId) ?? false;
  };

  const handleToggleProvider = (providerId: string, enabled: boolean) => {
    toggleProviderMutation.mutate({ providerId, enabled });
  };

  const handleStartEditingThreshold = () => {
    if (!isEditingThreshold) {
      setTempThreshold(settings?.free_shipping_threshold?.toString() || '');
      setIsEditingThreshold(true);
    }
  };

  const handleSaveThreshold = () => {
    const normalizedThreshold = tempThreshold.replaceAll(',', '').trim();

    if (!normalizedThreshold) {
      updateThresholdMutation.mutate(null);
      return;
    }

    const parsedThreshold = Number(normalizedThreshold);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      Alert.alert(
        'Invalid threshold',
        'Enter a valid non-negative amount for free shipping.'
      );
      return;
    }

    updateThresholdMutation.mutate(parsedThreshold);
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['bottom']}
        >
          <SystemBars style={isDark ? 'light' : 'dark'} />
          <ScreenSkeleton variant="settings" cards={4} />
        </SafeAreaView>
      </>
    );
  }

  if (isError) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Shipping settings are unavailable right now.';

    return (
      <>
        <Stack.Screen options={screenOptions} />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['bottom']}
        >
          <SystemBars style={isDark ? 'light' : 'dark'} />
          <View style={styles.errorState}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={colors.notification}
            />
            <Text style={[styles.errorTitle, { color: colors.text }]}>
              Failed to load shipping settings
            </Text>
            <Text
              style={[styles.errorDescription, { color: colors.textSecondary }]}
            >
              {errorMessage}
            </Text>
            <Pressable
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                void refetch();
              }}
              accessibilityRole="button"
              accessibilityLabel="Retry loading shipping settings"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const enabledCount = settings?.shipping_providers?.length ?? 0;

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <ProvidersList
            colors={colors}
            shadowStyle={shadows.sm}
            enabledCount={enabledCount}
            isPending={toggleProviderMutation.isPending}
            isProviderEnabled={isProviderEnabled}
            onToggleProvider={handleToggleProvider}
          />
          <ShippingForm
            colors={colors}
            shadowStyle={shadows.sm}
            settings={settings}
            isEditingThreshold={isEditingThreshold}
            tempThreshold={tempThreshold}
            isPending={updateThresholdMutation.isPending}
            onStartEditing={handleStartEditingThreshold}
            onThresholdChange={setTempThreshold}
            onSaveThreshold={handleSaveThreshold}
            onCancelEditing={() => setIsEditingThreshold(false)}
            onManageShipping={handleManageShipping}
          />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
