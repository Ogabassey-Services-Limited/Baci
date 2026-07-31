import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StatusBar, View } from 'react-native';
import { StoreLogoSection } from '@/components/store-settings/StoreLogoSection';
import { StoreSettingsBackButton } from '@/components/store-settings/StoreSettingsBackButton';
import { StoreSettingsDetailsCard } from '@/components/store-settings/StoreSettingsDetailsCard';
import { StoreSettingsLoadError } from '@/components/store-settings/StoreSettingsLoadError';
import { StoreSettingsSaveButton } from '@/components/store-settings/StoreSettingsSaveButton';
import { StoreSubscriptionCard } from '@/components/store-settings/StoreSubscriptionCard';
import { storeSettingsStyles as styles } from '@/components/store-settings/store-settings.styles';
import {
  buildBaselineFromMerchant,
  buildInitialFormValues,
  hasNonEmptyTrimmedValue,
  rebaseStoreSettingsBaseline,
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
import { useMerchant } from '@/hooks/useMerchant';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useStoreSettingsFormDirty } from '@/hooks/useStoreSettingsFormDirty';
import {
  type RefreshedLocalStoreSettingsSave,
  useStoreSettingsSaveLifecycle,
} from '@/hooks/useStoreSettingsSaveLifecycle';
import { useSubscriptionManagement } from '@/hooks/useSubscriptionManagement';
import { useTheme } from '@/hooks/useTheme';
import { SubscriptionManagement } from '@/utils/SubscriptionManagement';

export default function StoreSettingsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const queryClient = useQueryClient();
  const { merchant, isLoading } = useMerchant();
  const { isPro } = useRevenueCat();
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
  const { getFormRevision, isFormDirty, markFormDirty, resetFormDirty } =
    useStoreSettingsFormDirty();
  const [syncedMerchant, setSyncedMerchant] = useState<typeof merchant | null>(
    null
  );
  const [syncedMerchantUpdatedAt, setSyncedMerchantUpdatedAt] = useState<
    string | null
  >(null);
  const [baseline, setBaseline] = useState<StoreSettingsFormValues | null>(
    null
  );
  const { handleManageSubscription } = useSubscriptionManagement({
    setStatusModal,
  });

  const hasMerchantChanged = merchant?.id !== syncedMerchant?.id;

  if (
    merchant &&
    merchant !== syncedMerchant &&
    (!isFormDirty || hasMerchantChanged)
  ) {
    if (hasMerchantChanged) resetFormDirty();
    setSyncedMerchant(merchant);
    setSyncedMerchantUpdatedAt(merchant.updated_at ?? null);
    const initialForm = buildInitialFormValues(merchant);
    setBaseline(buildBaselineFromMerchant(merchant));
    setBusinessName(initialForm.businessName);
    setPhone(initialForm.phone);
    setSupportPhone(initialForm.supportPhone);
    setEmail(initialForm.email);
    setAddress(initialForm.address);
    setCountry(initialForm.country);
    setCurrency(initialForm.currency);
    setSlug(initialForm.slug);
    setIsSlugEdited(hasNonEmptyTrimmedValue(merchant.slug));
  }

  const hasEstablishedMerchantSlug = hasNonEmptyTrimmedValue(baseline?.slug);
  const authEmailPrefill = syncedMerchant?.support_email
    ? ''
    : syncedMerchant?.email || '';

  const handleCountrySelect = (selected: (typeof COUNTRIES)[0]) => {
    markFormDirty();
    setCountry(selected.code);
    setCurrency(selected.currency);
    setShowCountryModal(false);
  };

  const handleBusinessNameChange = (text: string) => {
    markFormDirty();
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

    markFormDirty();
    setIsSlugEdited(true);
    const sanitized = text.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(sanitized);
  };

  const invalidateMerchantQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['merchant'] }),
      queryClient.invalidateQueries({ queryKey: ['merchant-settings'] }),
    ]);
  };

  const updateFormValue = (setter: (value: string) => void, value: string) => {
    markFormDirty();
    setter(value);
  };

  const adoptRefreshedLocalSave = (save: RefreshedLocalStoreSettingsSave) => {
    setSyncedMerchantUpdatedAt(save.updatedAt);
    setBaseline((previous) =>
      previous
        ? rebaseStoreSettingsBaseline({
            authEmailPrefill,
            baseline: previous,
            displayedSupportEmail: email,
            savedValues: save.savedValues,
          })
        : previous
    );
  };

  const { handleCloseStatusModal, isSaving, startSave } =
    useStoreSettingsSaveLifecycle({
      baseline,
      formValues: {
        business_name: businessName,
        phone,
        support_phone: supportPhone,
        support_email: email,
        business_address: address,
        country,
        payout_currency: currency,
        slug,
      },
      from,
      getFormRevision,
      merchant,
      onRefreshedLocalSave: adoptRefreshedLocalSave,
      queryClient,
      resetFormDirty,
      router,
      setStatusModal,
      syncedMerchantUpdatedAt,
    });

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenSkeleton variant="settings" cards={5} />
      </View>
    );
  }

  if (!merchant) {
    return (
      <StoreSettingsLoadError
        colors={colors}
        onRetry={() =>
          void queryClient.invalidateQueries({ queryKey: ['merchant'] })
        }
      />
    );
  }

  const selectedCountry = COUNTRIES.find(
    (candidate) => candidate.code === country || candidate.name === country
  );
  const selectedCountryCode = selectedCountry?.code || COUNTRIES[0].code;
  const selectedCountryLabel = selectedCountry?.name || country;
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
              isSaving={isSaving}
              onPress={startSave}
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
          colors={colors}
          logoUri={merchant?.logo_url}
          merchantId={merchant?.id}
          onStatusChange={setStatusModal}
          onUploadSuccess={invalidateMerchantQueries}
          shadowStyle={shadows.sm}
        />

        <StoreSettingsDetailsCard
          address={address}
          businessName={businessName}
          colors={colors}
          countryCode={selectedCountryCode}
          countryLabel={selectedCountryLabel}
          currency={currency}
          email={email}
          googleMapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
          isDark={isDark}
          onAddressChange={(value) => updateFormValue(setAddress, value)}
          onBusinessNameChange={handleBusinessNameChange}
          onEmailChange={(value) => updateFormValue(setEmail, value)}
          onOpenCountryPicker={() => setShowCountryModal(true)}
          onPhoneChange={(value) => updateFormValue(setPhone, value)}
          onSlugChange={handleSlugChange}
          onSupportPhoneChange={(value) =>
            updateFormValue(setSupportPhone, value)
          }
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

        <StatusModal
          status={statusModal}
          onClose={() => handleCloseStatusModal(statusModal)}
        />
      </AppFormScreen>
    </>
  );
}
