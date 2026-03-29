/**
 * Payment Methods Screen
 * Displays actual payment settings from database
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaymentMethodsSection } from '@/components/payment-methods/PaymentMethodsSection';
import {
  type PaymentMethodField,
  type PaymentSettings,
  paymentMethods,
} from '@/components/payment-methods/payment-methods';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

export default function PaymentMethodsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch actual payment settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['payment-settings', user?.id],
    queryFn: async () => {
      // First get merchant ID
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!merchant) throw new Error('No merchant found');

      const { data, error } = await supabase
        .from('merchant_feature_settings')
        .select(
          'id, merchant_id, paystack_enabled, korapay_enabled, credit_direct_enabled, credpal_enabled, pay_on_delivery_enabled, juicyway_enabled'
        )
        .eq('merchant_id', merchant.id)
        .single();

      if (error) throw error;
      return data as PaymentSettings;
    },
    enabled: !!user?.id,
  });

  // Toggle mutation with Optimistic Updates (2026 Best Practice)
  const toggleMutation = useMutation({
    mutationFn: async ({
      field,
      value,
    }: {
      field: PaymentMethodField;
      value: boolean;
    }) => {
      if (!settings?.id) throw new Error('No settings found');
      const { error } = await supabase
        .from('merchant_feature_settings')
        .update({ [field]: value })
        .eq('id', settings.id);
      if (error) throw error;
    },
    onMutate: async ({ field, value }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({
        queryKey: ['payment-settings', user?.id],
      });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData([
        'payment-settings',
        user?.id,
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        ['payment-settings', user?.id],
        (old: PaymentSettings | undefined) => {
          if (!old) return old;
          return {
            ...old,
            [field]: value,
          };
        }
      );

      // Return a context object with the snapshotted value
      return { previousSettings };
    },
    onError: (error, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousSettings) {
        queryClient.setQueryData(
          ['payment-settings', user?.id],
          context.previousSettings
        );
      }
      const msg = (error as Error)?.message || 'Failed to update setting';
      Alert.alert('Error', msg);
    },
    onSettled: () => {
      // Always refetch after error or success:
      queryClient.invalidateQueries({ queryKey: ['payment-settings'] });
    },
  });

  const handleManagePayments = () => {
    Linking.openURL('https://usebaci.com/dashboard/settings/payments');
  };

  const handleTogglePaymentMethod = (
    field: PaymentMethodField,
    value: boolean
  ) => {
    toggleMutation.mutate({ field, value });
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Stack.Screen
          options={{
            title: 'Payment Methods',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <ScreenSkeleton variant="settings" cards={6} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Payment Methods',
          // Native back button will be used
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
        >
          <PaymentMethodsSection
            title="Payment Gateways"
            category="gateway"
            methods={paymentMethods}
            settings={settings}
            colors={colors}
            shadowStyle={shadows.sm}
            isPending={toggleMutation.isPending}
            onToggle={handleTogglePaymentMethod}
          />
          <PaymentMethodsSection
            title="Buy Now, Pay Later"
            category="bnpl"
            methods={paymentMethods}
            settings={settings}
            colors={colors}
            shadowStyle={shadows.sm}
            isPending={toggleMutation.isPending}
            onToggle={handleTogglePaymentMethod}
          />
          <PaymentMethodsSection
            title="Offline Payments"
            category="offline"
            methods={paymentMethods}
            settings={settings}
            colors={colors}
            shadowStyle={shadows.sm}
            isPending={toggleMutation.isPending}
            onToggle={handleTogglePaymentMethod}
          />

          {/* Info Notice */}
          <View
            style={[
              styles.notice,
              { backgroundColor: colors.infoLight || '#EFF6FF' },
            ]}
          >
            <Ionicons
              name="information-circle"
              size={20}
              color={colors.info || '#3B82F6'}
            />
            <Text
              style={[styles.noticeText, { color: colors.info || '#3B82F6' }]}
            >
              API keys and webhook configuration available on web dashboard.
            </Text>
          </View>

          {/* Manage Button */}
          <Pressable
            style={[styles.manageButton, { backgroundColor: colors.primary }]}
            onPress={handleManagePayments}
          >
            <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
            <Text style={styles.manageButtonText}>Advanced Settings</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.lg,
  },
  noticeText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
  },
  manageButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
