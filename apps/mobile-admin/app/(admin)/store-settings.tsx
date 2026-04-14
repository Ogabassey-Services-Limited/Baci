import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
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
import { useMerchant } from '@/hooks/useMerchant';
import { useRevenueCat } from '@/hooks/useRevenueCat';
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
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0].code);
  const [currency, setCurrency] = useState(COUNTRIES[0].currency);
  const [slug, setSlug] = useState('');
  const [isSlugEdited, setIsSlugEdited] = useState(false);
  useEffect(() => {
    if (merchant) {
      setBusinessName(merchant.business_name || '');
      setPhone(merchant.phone || merchant.support_phone || '');
      setEmail(merchant.email || merchant.support_email || '');
      setAddress(merchant.business_address || '');

      const initialCountry = merchant.country || COUNTRIES[0].code;
      setCountry(initialCountry);

      const defaultCurrencyForCountry = COUNTRIES.find(
        (c) => c.code === initialCountry || c.name === initialCountry
      )?.currency;
      setCurrency(
        merchant.payout_currency ||
          defaultCurrencyForCountry ||
          COUNTRIES[0].currency
      );

      setSlug(merchant.slug || '');
      if (merchant.slug) setIsSlugEdited(true);
    }
  }, [merchant]);

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
      if (!merchant?.id) throw new Error('No merchant found');
      const { error } = await supabase
        .from('merchants')
        .update({
          business_name: businessName,
          phone: phone,
          support_phone: phone,
          support_email: email,
          business_address: address,
          country: country,
          payout_currency: currency,
          slug: slug,
        })
        .eq('id', merchant.id);
      if (error) throw error;
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
  const planLabel = SubscriptionManagement.getPlanLabel(isPro);
  // Native subscription management opens a different store on each platform.
  const manageSubscriptionLabel =
    Platform.OS === 'ios' ? 'Manage in App Store' : 'Manage in Google Play';

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
      <SystemBars style={isDark ? 'light' : 'dark'} />

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
          phone={phone}
          shadowStyle={shadows.sm}
          slug={slug}
        />

        <StoreSubscriptionCard
          colors={colors}
          isPro={isPro}
          manageSubscriptionLabel={manageSubscriptionLabel}
          onManageSubscription={async () => {
            try {
              await SubscriptionManagement.openNativeManagement();
            } catch {
              setStatusModal({
                visible: true,
                type: 'error',
                title: 'Unable to Open',
                message:
                  'Could not open subscription management. Please try again.',
              });
            }
          }}
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
