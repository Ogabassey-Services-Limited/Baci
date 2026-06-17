import Ionicons from '@react-native-vector-icons/ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StoreSettingsDetailsCard } from '@/components/store-settings/StoreSettingsDetailsCard';
import { StoreSubscriptionCard } from '@/components/store-settings/StoreSubscriptionCard';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { CountryPickerModal } from '@/components/ui/CountryPickerModal';
import { LogoPicker } from '@/components/ui/LogoPicker';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import {
  StatusModal,
  type StatusModalState,
} from '@/components/ui/StatusModal';
import { COUNTRIES } from '@/constants/countries';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useCachedImageUri } from '@/hooks/useCachedImageUri';
import { type Merchant, useMerchant } from '@/hooks/useMerchant';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { SubscriptionManagement } from '@/utils/SubscriptionManagement';

/** Editable merchant columns owned by the store-settings form. */
type EditableMerchantColumns = Pick<
  Merchant,
  | 'business_name'
  | 'phone'
  | 'support_phone'
  | 'support_email'
  | 'business_address'
  | 'country'
  | 'payout_currency'
  | 'slug'
>;

/** Form values for the editable columns (always strings — empty when blank). */
type StoreSettingsFormValues = {
  [K in keyof EditableMerchantColumns]: string;
};

/**
 * Build a changed-only update payload by diffing the current form values against
 * the baseline values captured when the merchant was loaded. Only columns whose
 * value actually changed are included, so a stale full-form snapshot can never
 * revert an untouched column. Returns an empty object when nothing changed.
 */
export function buildMerchantUpdatePayload(
  baseline: StoreSettingsFormValues,
  formValues: StoreSettingsFormValues
): Partial<EditableMerchantColumns> {
  const payload: Partial<EditableMerchantColumns> = {};

  for (const key of Object.keys(
    formValues
  ) as (keyof StoreSettingsFormValues)[]) {
    if (formValues[key] !== baseline[key]) {
      payload[key] = formValues[key];
    }
  }

  return payload;
}

export default function StoreSettingsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { merchant, isLoading } = useMerchant();
  const { isPro } = useRevenueCat();
  const { uri: cachedLogoUri } = useCachedImageUri(merchant?.logo_url);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusModalState>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0].code);
  const [currency, setCurrency] = useState(COUNTRIES[0].currency);
  const [slug, setSlug] = useState('');
  const [isSlugEdited, setIsSlugEdited] = useState(false);
  const [syncedMerchant, setSyncedMerchant] = useState<typeof merchant | null>(
    null
  );
  // Snapshot of the form values as loaded, used to diff only the edited columns.
  const [baseline, setBaseline] = useState<StoreSettingsFormValues | null>(
    null
  );
  const { handleManageSubscription } = useSubscriptionManagement({
    setStatusModal,
  });

  // Adjust form state during render when the merchant identity changes so the
  // form never paints a stale frame (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (merchant && merchant !== syncedMerchant) {
    setSyncedMerchant(merchant);

    const initialBusinessName = merchant.business_name || '';
    const initialPhone = merchant.phone || '';
    const initialSupportPhone = merchant.support_phone || '';
    const initialEmail = merchant.email || merchant.support_email || '';
    const initialAddress = merchant.business_address || '';

    const initialCountry = merchant.country || COUNTRIES[0].code;
    const defaultCurrencyForCountry = COUNTRIES.find(
      (c) => c.code === initialCountry || c.name === initialCountry
    )?.currency;
    const initialCurrency =
      merchant.payout_currency ||
      defaultCurrencyForCountry ||
      COUNTRIES[0].currency;
    const initialSlug = merchant.slug || '';

    setBusinessName(initialBusinessName);
    setPhone(initialPhone);
    setSupportPhone(initialSupportPhone);
    setEmail(initialEmail);
    setAddress(initialAddress);
    setCountry(initialCountry);
    setCurrency(initialCurrency);
    setSlug(initialSlug);
    if (merchant.slug) setIsSlugEdited(true);

    // Capture the loaded values so the save can diff only the edited columns.
    setBaseline({
      business_name: initialBusinessName,
      phone: initialPhone,
      support_phone: initialSupportPhone,
      support_email: initialEmail,
      business_address: initialAddress,
      country: initialCountry,
      payout_currency: initialCurrency,
      slug: initialSlug,
    });
  }

  const handleCountrySelect = (selected: (typeof COUNTRIES)[0]) => {
    setCountry(selected.code);
    setCurrency(selected.currency);
    setShowCountryModal(false);
  };

  const handleBusinessNameChange = (text: string) => {
    setBusinessName(text);
    if (!isSlugEdited && !merchant?.slug) {
      const generated = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generated);
    }
  };

  const handleSlugChange = (text: string) => {
    setIsSlugEdited(true);
    const sanitized = text.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(sanitized);
  };

  const invalidateMerchantQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['merchant'] });
    queryClient.invalidateQueries({ queryKey: ['merchant-settings'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id || !baseline) throw new Error('No merchant found');

      // Build the payload from a dirty-field diff against the loaded snapshot so
      // only edited columns are written. This stops a stale full-form snapshot
      // from reverting columns the user never touched (the recurring identity
      // drift) and keeps phone/support_phone as independent columns.
      const payload = buildMerchantUpdatePayload(baseline, {
        business_name: businessName,
        phone,
        support_phone: supportPhone,
        support_email: email,
        business_address: address,
        country,
        payout_currency: currency,
        slug,
      });

      // Nothing changed — skip the write entirely.
      if (Object.keys(payload).length === 0) {
        return;
      }

      let query = supabase
        .from('merchants')
        .update(payload)
        .eq('id', merchant.id);

      // Optimistic-concurrency guard: only overwrite the row we actually loaded.
      // If the row moved on (updated_at differs), the filter matches no rows and
      // we surface a conflict instead of silently clobbering the newer write.
      const loadedUpdatedAt = syncedMerchant?.updated_at;
      if (loadedUpdatedAt) {
        query = query.eq('updated_at', loadedUpdatedAt);
      }

      const { data, error } = await query.select('id');
      if (error) throw error;

      if (loadedUpdatedAt && (!data || data.length === 0)) {
        throw new Error(
          'These settings changed elsewhere. Reopen the page and try again.'
        );
      }
    },
    onSuccess: () => {
      invalidateMerchantQueries();
      queryClient.invalidateQueries({ queryKey: ['store-readiness'] });
      setStatusModal({
        visible: true,
        type: 'success',
        title: 'Success!',
        message: 'Store settings updated successfully.',
      });
    },
    onError: (error: unknown) => {
      console.error('Update error:', error);
      setStatusModal({
        visible: true,
        type: 'error',
        title: 'Update Failed',
        message: (error as Error).message || 'Failed to update store settings',
      });
    },
  });

  const handleCloseStatusModal = () => {
    if (statusModal.type === 'success' && statusModal.title === 'Success!') {
      setStatusModal((prev) => ({ ...prev, visible: false }));
      router.back();
    } else {
      setStatusModal((prev) => ({ ...prev, visible: false }));
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenSkeleton variant="settings" cards={5} />
      </View>
    );
  }

  const selectedCountryLabel =
    COUNTRIES.find((c) => c.code === country || c.name === country)?.name ||
    country;
  const planLabel = SubscriptionManagement.getPlanLabel(isPro) || 'Free Plan';
  const manageSubscriptionLabel =
    SubscriptionManagement.getManagementLabel() || 'Manage Subscription';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Store Settings',
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              accessibilityLabel="Save store settings"
              accessibilityRole="button"
              onPress={() => saveMutation.mutate()}
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
        }}
      />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <AppFormScreen
        contentContainerStyle={styles.scrollContent}
        edges={['bottom']}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View
          style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Store Logo
          </Text>
          <LogoPicker
            businessName={businessName}
            cachedLogoUri={cachedLogoUri}
            merchantId={merchant?.id}
            onStatusChange={setStatusModal}
            onUploadSuccess={invalidateMerchantQueries}
          />
        </View>

        <StoreSettingsDetailsCard
          address={address}
          businessName={businessName}
          colors={colors}
          countryLabel={selectedCountryLabel}
          currency={currency}
          email={email}
          onAddressChange={setAddress}
          onBusinessNameChange={handleBusinessNameChange}
          onEmailChange={setEmail}
          onOpenCountryPicker={() => setShowCountryModal(true)}
          onPhoneChange={setPhone}
          onSlugChange={handleSlugChange}
          onSupportPhoneChange={setSupportPhone}
          phone={phone}
          shadowStyle={shadows.sm}
          slug={slug}
          supportPhone={supportPhone}
        />

        <StoreSubscriptionCard
          colors={colors}
          isPro={isPro}
          manageSubscriptionLabel={manageSubscriptionLabel}
          onManageSubscription={handleManageSubscription}
          onOpenSubscriptionPlans={() => router.push('/(admin)/subscribe')}
          planLabel={planLabel}
          shadowStyle={shadows.sm}
        />

        <CountryPickerModal
          visible={showCountryModal}
          selectedCountry={country}
          onSelect={handleCountrySelect}
          onClose={() => setShowCountryModal(false)}
        />

        <StatusModal status={statusModal} onClose={handleCloseStatusModal} />
      </AppFormScreen>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  saveButton: { padding: SPACING.sm },
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
  card: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.sm,
  },
});
