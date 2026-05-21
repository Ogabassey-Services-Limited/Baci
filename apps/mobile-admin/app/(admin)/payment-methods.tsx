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
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PaymentMethodsSection } from '@/components/payment-methods/PaymentMethodsSection';
import {
  type PaymentMethodCategory,
  type PaymentMethodField,
  type PaymentSettings,
  getPaymentMethodDefinitionsForColumns,
  getRenderablePaymentMethods,
  parsePaymentSettings,
  paymentMethods,
  paymentSettingsSelectColumns,
} from '@/components/payment-methods/payment-methods';
import { styles } from '@/components/payment-methods/payment-methods.styles';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

const REQUIRED_PAYMENT_SETTINGS_COLUMNS = new Set(['id', 'merchant_id']);

type PostgrestErrorShape = {
  message?: string;
  details?: string;
  hint?: string;
};

function getMissingColumnFromPostgrestError(
  error: PostgrestErrorShape | null | undefined
): string | null {
  if (!error) return null;

  const text = [error.message, error.details, error.hint]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');

  if (!text) return null;

  const postgrestMatch = text.match(
    /Could not find the ['"]([^'"]+)['"] column/i
  );
  if (postgrestMatch?.[1]) {
    return postgrestMatch[1];
  }

  const postgresMatch = text.match(
    /column\s+\w+\.("?)([a-zA-Z0-9_]+)\1\s+does not exist/i
  );
  return postgresMatch?.[2] ?? null;
}

async function fetchPaymentSettings(
  merchantId: string,
  columns: string
): Promise<PaymentSettings> {
  let selectColumns = Array.from(
    new Set(
      columns
        .split(',')
        .map((column) => column.trim())
        .filter((column) => column.length > 0)
    )
  );

  const maxAttempts = selectColumns.length;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase
      .from('merchant_feature_settings')
      .select(selectColumns.join(', '))
      .eq('merchant_id', merchantId)
      .single();

    if (!error) {
      return parsePaymentSettings(
        data,
        getPaymentMethodDefinitionsForColumns(selectColumns)
      );
    }

    const missingColumn = getMissingColumnFromPostgrestError(error);
    if (
      !missingColumn ||
      !selectColumns.includes(missingColumn) ||
      REQUIRED_PAYMENT_SETTINGS_COLUMNS.has(missingColumn)
    ) {
      throw error;
    }

    const remainingColumns = selectColumns.filter(
      (column) => column !== missingColumn
    );
    if (remainingColumns.length === selectColumns.length) {
      throw error;
    }
    if (remainingColumns.length === 0) {
      throw error;
    }

    selectColumns = remainingColumns;
  }

  throw new Error('Unable to load payment settings');
}

export default function PaymentMethodsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const {
    merchant,
    isLoading: merchantLoading,
    error: merchantError,
  } = useMerchant();
  const queryClient = useQueryClient();
  const screenOptions = {
    title: 'Payment Methods',
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
  };
  const sections = [
    { title: 'Payment Gateways', category: 'gateway' },
    { title: 'Buy Now, Pay Later', category: 'bnpl' },
    { title: 'Offline Payments', category: 'offline' },
  ] as const satisfies ReadonlyArray<{
    title: string;
    category: PaymentMethodCategory;
  }>;

  // Fetch actual payment settings
  const {
    data: settings,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['payment-settings', merchant?.id],
    queryFn: async () => {
      if (!merchant?.id) throw new Error('Merchant not found');
      return fetchPaymentSettings(merchant.id, paymentSettingsSelectColumns);
    },
    enabled: !!merchant?.id,
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
        queryKey: ['payment-settings', merchant?.id],
      });

      // Snapshot the previous value
      const previousSettings = queryClient.getQueryData([
        'payment-settings',
        merchant?.id,
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        ['payment-settings', merchant?.id],
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
          ['payment-settings', merchant?.id],
          context.previousSettings
        );
      }
      const msg = (error as Error)?.message || 'Failed to update setting';
      Alert.alert('Error', msg);
    },
    onSettled: () => {
      // Always refetch after error or success:
      queryClient.invalidateQueries({
        queryKey: ['payment-settings', merchant?.id],
      });
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

  const loadError = merchantError ?? (isError ? error : null);
  const renderablePaymentMethods = getRenderablePaymentMethods(
    settings,
    paymentMethods
  );

  if (merchantLoading || isLoading) {
    return (
      <>
        <Stack.Screen options={screenOptions} />
        <SafeAreaView
          style={[styles.container, { backgroundColor: colors.background }]}
          edges={['bottom']}
        >
          <ScreenSkeleton variant="settings" cards={6} />
        </SafeAreaView>
      </>
    );
  }

  if (loadError) {
    const errorMessage =
      loadError instanceof Error
        ? loadError.message
        : 'Payment settings are unavailable right now.';

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
              Failed to load payment methods
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
              accessibilityLabel="Retry loading payment methods"
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </>
    );
  }

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
          {sections.map((section) => (
            <PaymentMethodsSection
              key={section.category}
              title={section.title}
              category={section.category}
              methods={renderablePaymentMethods}
              settings={settings}
              colors={colors}
              shadowStyle={shadows.sm}
              isPending={toggleMutation.isPending}
              onToggle={handleTogglePaymentMethod}
            />
          ))}

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
