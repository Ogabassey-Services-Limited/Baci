/**
 * Store Settings Screen
 * Configure store name, logo, and details
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StoreSubscriptionCard } from '@/components/store-settings/StoreSubscriptionCard';
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

  // Status Modal State
  const [statusModal, setStatusModal] = useState<StatusModalState>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0].code);
  const [currency, setCurrency] = useState(COUNTRIES[0].currency);

  // URL State
  const [slug, setSlug] = useState('');
  const [isSlugEdited, setIsSlugEdited] = useState(false);

  // Sync form with fetched data
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
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ScreenSkeleton variant="settings" cards={5} />
      </SafeAreaView>
    );
  }

  const manageSubscriptionLabel =
    Platform.OS === 'ios' ? 'Manage in App Store' : 'Manage in Google Play';

  const handleManageSubscription = async () => {
    try {
      await SubscriptionManagement.openNativeManagement();
    } catch {
      setStatusModal({
        visible: true,
        type: 'error',
        title: 'Unable to Open',
        message: 'Could not open subscription management. Please try again.',
      });
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Store Settings',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
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
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Logo Section */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Store Logo
            </Text>
            <LogoPicker
              merchantId={merchant?.id}
              cachedLogoUri={cachedLogoUri}
              businessName={businessName}
              onUploadSuccess={invalidateMerchantQueries}
              onStatusChange={setStatusModal}
            />
          </View>

          {/* Business Name */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Business Name
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border },
              ]}
              value={businessName}
              onChangeText={handleBusinessNameChange}
              placeholder="Enter business name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Phone */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Phone Number
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border },
              ]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          {/* Email */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Support Email
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: colors.text, borderColor: colors.border },
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter support email"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Address */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Business Address
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
                { color: colors.text, borderColor: colors.border },
              ]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter business address"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Region Settings */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Region Settings
            </Text>
            <View style={{ gap: SPACING.md }}>
              {/* Country Select */}
              <View>
                <Text
                  style={[
                    styles.sublabel,
                    {
                      color: colors.textSecondary,
                      marginBottom: 4,
                      fontSize: 12,
                    },
                  ]}
                >
                  Country
                </Text>
                <Pressable
                  style={[
                    styles.readOnlyInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      opacity: 1,
                    },
                  ]}
                  onPress={() => setShowCountryModal(true)}
                >
                  <Text style={{ color: colors.text }}>
                    {COUNTRIES.find(
                      (c) => c.code === country || c.name === country
                    )?.name || country}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>

              {/* Currency Display (Read-only, auto-updated) */}
              <View>
                <Text
                  style={[
                    styles.sublabel,
                    {
                      color: colors.textSecondary,
                      marginBottom: 4,
                      fontSize: 12,
                    },
                  ]}
                >
                  Currency
                </Text>
                <View
                  style={[
                    styles.readOnlyInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      opacity: 0.6,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text }}>{currency}</Text>
                  <Ionicons
                    name="lock-closed"
                    size={14}
                    color={colors.textMuted}
                  />
                </View>
              </View>
            </View>
          </View>

          <StoreSubscriptionCard
            colors={colors}
            isPro={isPro}
            manageSubscriptionLabel={manageSubscriptionLabel}
            onManageSubscription={handleManageSubscription}
            onOpenSubscriptionPlans={() => router.push('/(admin)/subscribe')}
            planLabel={SubscriptionManagement.getPlanLabel(isPro)}
            shadowStyle={shadows.sm}
          />

          {/* Store URL (Editable) */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Store URL
            </Text>
            <View
              style={[
                styles.urlContainer,
                {
                  backgroundColor: colors.cardHover,
                  flexDirection: 'row',
                  alignItems: 'center',
                },
              ]}
            >
              <TextInput
                style={[
                  styles.urlText,
                  { color: colors.text, flex: 1, padding: 0 },
                ]}
                value={slug}
                onChangeText={handleSlugChange}
                placeholder="your-store-name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
              />
              <Text style={[styles.urlText, { color: colors.textSecondary }]}>
                .usebaci.com
              </Text>
            </View>
            <Text
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                marginTop: 8,
              }}
            >
              This is your unique store link. Changing it will break existing
              links.
            </Text>
          </View>
        </ScrollView>

        <CountryPickerModal
          visible={showCountryModal}
          selectedCountry={country}
          onSelect={handleCountrySelect}
          onClose={() => setShowCountryModal(false)}
        />

        <StatusModal status={statusModal} onClose={handleCloseStatusModal} />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  saveButton: { padding: SPACING.sm },
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  planBadgeText: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    textTransform: 'uppercase',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.sm,
  },
  input: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  readOnlyInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    opacity: 0.8,
  },
  urlContainer: { padding: SPACING.md, borderRadius: RADIUS.md },
  urlText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  sublabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  subscriptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  subscriptionTextContainer: {
    marginLeft: SPACING.md,
  },
  subscriptionTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    fontSize: TYPOGRAPHY.size.md,
  },
  subscriptionSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.size.sm,
  },
});
