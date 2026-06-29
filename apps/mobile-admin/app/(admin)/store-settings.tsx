import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StatusBar, View } from 'react-native';
import { StoreSettingsDetailsCard } from '@/components/store-settings/StoreSettingsDetailsCard';
import { StoreSettingsBackButton } from '@/components/store-settings/StoreSettingsBackButton';
import { StoreLogoSection } from '@/components/store-settings/StoreLogoSection';
import { StoreSettingsSaveButton } from '@/components/store-settings/StoreSettingsSaveButton';
import { StoreSubscriptionCard } from '@/components/store-settings/StoreSubscriptionCard';
import { storeSettingsStyles as styles } from '@/components/store-settings/store-settings.styles';
import {
  buildBaselineFromMerchant,
  buildInitialFormValues,
  buildMerchantUpdatePayload,
  hasNonEmptyTrimmedValue,
  type StoreSettingsFormValues,
} from '@/components/store-settings/store-settings-payload';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { CountryPickerModal } from '@/components/ui/CountryPickerModal';
import { ScreenSkeleton } from '@/components/ui/ScreenSkeleton';
import {
  StatusModal,
  type StatusModalState,
} from '@/components/ui/StatusModal';
import { COUNTRIES } from '@/constants/countries';
import { useCachedImageUri } from '@/hooks/useCachedImageUri';
import { useMerchant } from '@/hooks/useMerchant';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { SubscriptionManagement } from '@/utils/SubscriptionManagement';

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

    // Form state uses UI fallbacks (e.g. a default country/currency) so the
    // picker is never empty.
    const initialForm = buildInitialFormValues(merchant);
    setBusinessName(initialForm.businessName);
    setPhone(initialForm.phone);
    setSupportPhone(initialForm.supportPhone);
    setEmail(initialForm.email);
    setAddress(initialForm.address);
    setCountry(initialForm.country);
    setCurrency(initialForm.currency);
    setSlug(initialForm.slug);
    setIsSlugEdited(hasNonEmptyTrimmedValue(merchant.slug));

    // The baseline diffs against the merchant's REAL persisted columns (null →
    // empty string), never the UI fallback. Otherwise a merchant whose country
    // is null would baseline to the visible default, so saving that default
    // would produce an empty diff and never write the column.
    setBaseline(buildBaselineFromMerchant(merchant));
  }

  const hasEstablishedMerchantSlug = hasNonEmptyTrimmedValue(
    baseline?.slug ?? merchant?.slug
  );

  const handleCountrySelect = (selected: (typeof COUNTRIES)[0]) => {
    setCountry(selected.code);
    setCurrency(selected.currency);
    setShowCountryModal(false);
  };

  const handleBusinessNameChange = (text: string) => {
    setBusinessName(text);
    if (!(isSlugEdited || hasEstablishedMerchantSlug)) {
      const generated = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generated);
    }
  };

  const handleSlugChange = (text: string) => {
    if (hasEstablishedMerchantSlug) return;

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
            <StoreSettingsBackButton
              color={colors.text}
              onPress={() => router.back()}
            />
          ),
          headerRight: () => (
            <StoreSettingsSaveButton
              colors={colors}
              isSaving={saveMutation.isPending}
              onPress={() => saveMutation.mutate()}
            />
          ),
        }}
      />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <AppFormScreen
        contentContainerStyle={styles.scrollContent}
        edges={['bottom']}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <StoreLogoSection
          businessName={businessName}
          cachedLogoUri={cachedLogoUri}
          colors={colors}
          merchantId={merchant?.id}
          onStatusChange={setStatusModal}
          onUploadSuccess={invalidateMerchantQueries}
          shadowStyle={shadows.sm}
        />

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
          slugLocked={hasEstablishedMerchantSlug}
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
