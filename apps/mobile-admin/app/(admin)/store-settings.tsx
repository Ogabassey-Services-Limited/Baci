/**
 * Store Settings Screen
 * Configure store name, logo, and details
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Supported Countries Configuration
import { COUNTRIES } from '@/constants/countries';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

// Jumia Integration Component
function _JumiaIntegrationRow({ statusModal }: { statusModal: any }) {
  const { colors } = useTheme();
  const [isConnected, setIsConnected] = useState(false);
  const [_checking, setChecking] = useState(true);

  // TODO: Move to config
  const WEB_APP_URL = 'https://usebaci.com';

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const checkStatus = async () => {
    try {
      // We can't easily check status without auth cookies on the API route from mobile
      // So for now we rely on user action or maybe we assume disconnected until explicit check
      // However, if we want to show "Connected", we need a way.
      // For this MVP, we will let them "Connect" always, or we could implement a secure check via Supabase RPC.
      // Let's skip auto-check for MVP to avoid complexity with cookies vs JWT.
      // The user will know if they connected.
      // actually, let's just default to false and let them connect.
      setChecking(false);
    } catch (_e) {
      setChecking(false);
    }
  };

  const handleConnectJumia = async () => {
    try {
      const _callbackUrl = Linking.createURL('jumia-callback'); // baciadmin://jumia-callback
      // We use the scheme directly in the backend: baciadmin://

      const authUrl = `${WEB_APP_URL}/api/marketplace/jumia/connect?connectionType=oauth&platform=mobile`;

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'baciadmin://'
      );

      if (result.type === 'success' && result.url) {
        const { queryParams } = Linking.parse(result.url);
        if (queryParams?.success === 'jumia_connected') {
          setIsConnected(true);
          statusModal({
            visble: true,
            type: 'success',
            title: 'Connected',
            message: 'Jumia account connected successfully!',
          });
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#FF9900',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Text style={{ color: '#FFF', fontWeight: 'bold' }}>J</Text>
        </View>
        <View>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
            Jumia
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Africa's no.1 marketplace
          </Text>
        </View>
      </View>

      <Pressable
        onPress={handleConnectJumia}
        style={{
          backgroundColor: isConnected ? '#E8F5E9' : colors.primary,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
        }}
      >
        <Text
          style={{
            color: isConnected ? '#2E7D32' : '#FFF',
            fontWeight: '600',
            fontSize: 12,
          }}
        >
          {isConnected ? 'Connected' : 'Connect'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function StoreSettingsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { merchant, isLoading } = useMerchant();
  const [isUploading, setIsUploading] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  // Status Modal State
  const [statusModal, setStatusModal] = useState<{
    visible: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
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
  const [country, setCountry] = useState(COUNTRIES[0].name);
  const [currency, setCurrency] = useState(COUNTRIES[0].currency);

  // Social & Analytics State

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

      // Social Media

      const initialCountry = merchant.country || COUNTRIES[0].name;
      setCountry(initialCountry);

      // Prioritize saved payout_currency, then fallback to country's default currency, then default DZD
      const defaultCurrencyForCountry = COUNTRIES.find(
        (c) => c.name === initialCountry
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
    setCountry(selected.code); // SAVE CODE NOT NAME
    setCurrency(selected.currency);
    setShowCountryModal(false);
  };

  // ... (Handle Image Pick and Upload unchanged) ...
  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await uploadLogo(asset.uri);
      }
    } catch (error) {
      console.error('Pick image error:', error);
      setStatusModal({
        visible: true,
        type: 'error',
        title: 'Image Selection Failed',
        message: 'Failed to select image from gallery',
      });
    }
  };

  const uploadLogo = async (uri: string) => {
    if (!merchant?.id) return;
    setIsUploading(true);

    try {
      // Create FormData for upload
      const formData = new FormData();
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${merchant.id}/${fileName}`;
      const mimeType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

      // Append file as expected by Supabase/RN polyfill
      formData.append('file', {
        uri,
        name: fileName,
        type: mimeType,
      } as unknown as Blob);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, formData, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('media').getPublicUrl(filePath);

      // Update merchant logo_url
      const { error: updateError } = await supabase
        .from('merchants')
        .update({ logo_url: publicUrl })
        .eq('id', merchant.id);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-settings'] });

      setStatusModal({
        visible: true,
        type: 'success',
        title: 'Logo Updated',
        message: 'Your store logo has been updated successfully.',
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Upload error:', err);
      setStatusModal({
        visible: true,
        type: 'error',
        title: 'Upload Failed',
        message: err.message || 'Failed to upload logo',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Auto-generate slug from business name if not manually edited
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

  // Save mutation
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
          payout_currency: currency, // Use payout_currency to match schema
          slug: slug, // Saving the slug
        })
        .eq('id', merchant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-settings'] });
      queryClient.invalidateQueries({ queryKey: ['store-readiness'] }); // Refresh checklist
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Store Settings',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
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
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

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
            <View style={styles.logoContainer}>
              {merchant?.logo_url ? (
                <Image
                  source={{ uri: merchant.logo_url }}
                  style={styles.logo}
                  contentFit="contain"
                />
              ) : (
                <View
                  style={[
                    styles.logoPlaceholder,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={styles.logoPlaceholderText}>
                    {businessName.charAt(0).toUpperCase() || 'S'}
                  </Text>
                </View>
              )}
              <Pressable
                style={[
                  styles.changeLogoButton,
                  { borderColor: colors.border },
                ]}
                onPress={handleImagePick}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons
                      name="camera-outline"
                      size={20}
                      color={colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.changeLogoText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Change
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
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

          {/* Store URL (Read-only) */}
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

        {/* Country Picker Modal */}
        <Modal
          visible={showCountryModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCountryModal(false)}
        >
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select Country
              </Text>
              <Pressable
                onPress={() => setShowCountryModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            {/* Search Bar */}
            <View style={{ padding: SPACING.md, paddingBottom: 0 }}>
              <View
                style={[
                  styles.searchContainer,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color={colors.textSecondary}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search country..."
                  placeholderTextColor={colors.textMuted}
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  autoCorrect={false}
                />
                {countrySearch.length > 0 && (
                  <Pressable onPress={() => setCountrySearch('')}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                )}
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
              {filteredCountries.map((item) => (
                <Pressable
                  key={item.code}
                  style={[
                    styles.countryItem,
                    {
                      backgroundColor:
                        country === item.name
                          ? colors.primaryLight
                          : colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handleCountrySelect(item)}
                >
                  <View>
                    <Text
                      style={[
                        styles.countryName,
                        {
                          color: colors.text,
                          fontWeight: country === item.name ? 'bold' : 'normal',
                        },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.currencyText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.currency} ({item.currencySymbol})
                    </Text>
                  </View>
                  {country === item.name && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Custom Status Modal */}
        <Modal
          visible={statusModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => handleCloseStatusModal()}
        >
          <View style={styles.statusModalOverlay}>
            <View
              style={[styles.statusModalCard, { backgroundColor: colors.card }]}
            >
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor:
                      statusModal.type === 'success' ? '#E8F5E9' : '#FFEBEE',
                  },
                ]}
              >
                <Ionicons
                  name={statusModal.type === 'success' ? 'checkmark' : 'alert'}
                  size={32}
                  color={statusModal.type === 'success' ? '#2E7D32' : '#C62828'}
                />
              </View>
              <Text style={[styles.statusTitle, { color: colors.text }]}>
                {statusModal.title}
              </Text>
              <Text
                style={[styles.statusMessage, { color: colors.textSecondary }]}
              >
                {statusModal.message}
              </Text>
              <Pressable
                style={[
                  styles.statusButton,
                  {
                    backgroundColor:
                      statusModal.type === 'success'
                        ? colors.primary
                        : '#C62828',
                  },
                ]}
                onPress={handleCloseStatusModal}
              >
                <Text style={styles.statusButtonText}>Okay</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  saveButton: { padding: SPACING.sm },
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING['3xl'] },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: SPACING.md,
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
  inputBg: {
    backgroundColor: '#F0F0F0', // Example light background for input
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  inputWithIcon: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  logo: { width: 80, height: 80, borderRadius: RADIUS.lg },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: '#FFFFFF',
  },
  changeLogoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  changeLogoText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
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
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  closeButton: { position: 'absolute', right: SPACING.md, padding: SPACING.sm },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  countryName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  currencyText: { fontSize: TYPOGRAPHY.size.sm },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    height: '100%',
  },
  // Status Modal Styles
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  statusModalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: RADIUS['2xl'],
    padding: SPACING['2xl'],
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  statusTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  statusButton: {
    width: '100%',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
  },
  statusButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  navRowText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  sublabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
});
