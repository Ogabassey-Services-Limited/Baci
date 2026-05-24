import Ionicons from "@react-native-vector-icons/ionicons/static";
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
import type {
  ProviderId,
  ShippingSettings,
} from '@/components/shipping/shipping-types';
import { parseShippingSettings } from '@/components/shipping/shipping-types';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

interface ShippingSettingsQueryData {
  currency: string | null;
  settings: ShippingSettings;
}

export default function ShippingScreen() {
  const { colors, shadows, isDark } = useTheme();
  const {
    merchant,
    isLoading: merchantLoading,
    error: merchantError,
  } = useMerchant();
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
    data: shippingData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['shipping-settings', merchant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_feature_settings')
        .select('merchant_id, shipping_providers, free_shipping_threshold')
        .eq('merchant_id', merchant?.id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Shipping settings not found');
      return {
        currency: merchant?.payout_currency ?? null,
        settings: parseShippingSettings(data),
      } satisfies ShippingSettingsQueryData;
    },
    enabled: !!merchant?.id,
  });
  const settings = shippingData?.settings;
  const currency = shippingData?.currency ?? merchant?.payout_currency ?? 'NGN';

  // Toggle provider mutation
  const toggleProviderMutation = useMutation({
    mutationFn: async ({
      providerId,
      enabled,
    }: {
      providerId: ProviderId;
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
      queryClient.invalidateQueries({
        queryKey: ['shipping-settings', merchant?.id],
      });
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
      queryClient.invalidateQueries({
        queryKey: ['shipping-settings', merchant?.id],
      });
      setIsEditingThreshold(false);
    },
    onError: (_error: unknown) => {
      Alert.alert('Error', 'Failed to update free shipping threshold');
    },
  });

  const handleManageShipping = () => {
    Linking.openURL('https://usebaci.com/dashboard/settings/shipping');
  };

  const isProviderEnabled = (providerId: ProviderId) => {
    return settings?.shipping_providers?.includes(providerId) ?? false;
  };

  const handleToggleProvider = (providerId: ProviderId, enabled: boolean) => {
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

  const loadError = merchantError ?? (isError ? error : null);

  if (merchantLoading || isLoading) {
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

  if (loadError) {
    const errorMessage =
      loadError instanceof Error
        ? loadError.message
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
            currency={currency}
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
