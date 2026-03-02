/**
 * Tax Settings Screen
 * Configure VAT, tax identification, legal entity, and registered address
 */

import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

const NIGERIAN_STATES = [
  { name: 'Abia', code: 'NG-AB' },
  { name: 'Adamawa', code: 'NG-AD' },
  { name: 'Akwa Ibom', code: 'NG-AK' },
  { name: 'Anambra', code: 'NG-AN' },
  { name: 'Bauchi', code: 'NG-BA' },
  { name: 'Bayelsa', code: 'NG-BY' },
  { name: 'Benue', code: 'NG-BE' },
  { name: 'Borno', code: 'NG-BO' },
  { name: 'Cross River', code: 'NG-CR' },
  { name: 'Delta', code: 'NG-DE' },
  { name: 'Ebonyi', code: 'NG-EB' },
  { name: 'Edo', code: 'NG-ED' },
  { name: 'Ekiti', code: 'NG-EK' },
  { name: 'Enugu', code: 'NG-EN' },
  { name: 'FCT', code: 'NG-FC' },
  { name: 'Gombe', code: 'NG-GO' },
  { name: 'Imo', code: 'NG-IM' },
  { name: 'Jigawa', code: 'NG-JI' },
  { name: 'Kaduna', code: 'NG-KD' },
  { name: 'Kano', code: 'NG-KN' },
  { name: 'Katsina', code: 'NG-KT' },
  { name: 'Kebbi', code: 'NG-KE' },
  { name: 'Kogi', code: 'NG-KO' },
  { name: 'Kwara', code: 'NG-KW' },
  { name: 'Lagos', code: 'NG-LA' },
  { name: 'Nasarawa', code: 'NG-NA' },
  { name: 'Niger', code: 'NG-NI' },
  { name: 'Ogun', code: 'NG-OG' },
  { name: 'Ondo', code: 'NG-ON' },
  { name: 'Osun', code: 'NG-OS' },
  { name: 'Oyo', code: 'NG-OY' },
  { name: 'Plateau', code: 'NG-PL' },
  { name: 'Rivers', code: 'NG-RI' },
  { name: 'Sokoto', code: 'NG-SO' },
  { name: 'Taraba', code: 'NG-TA' },
  { name: 'Yobe', code: 'NG-YO' },
  { name: 'Zamfara', code: 'NG-ZA' },
] as const;

interface RegisteredAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}

export default function TaxScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { merchant, isLoading } = useMerchant();
  const queryClient = useQueryClient();

  // Local state for optimistic UI
  const [vatEnabled, setVatEnabled] = useState(
    merchant?.vat_registration_status === 'registered'
  );
  const [taxId, setTaxId] = useState(merchant?.tax_identification_number ?? '');
  const [legalEntityName, setLegalEntityName] = useState(
    merchant?.legal_entity_name ?? ''
  );

  // Address state
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [showStateModal, setShowStateModal] = useState(false);

  // Fetch registered address (not in the RPC schema)
  const { data: addressData } = useQuery({
    queryKey: ['merchant-address', merchant?.id],
    queryFn: async () => {
      if (!merchant?.id) return null;
      const { data } = await supabase
        .from('merchants')
        .select('registered_address, state_code')
        .eq('id', merchant.id)
        .single();
      return data;
    },
    enabled: !!merchant?.id,
  });

  // Sync address data when fetched
  React.useEffect(() => {
    if (addressData) {
      const addr = addressData.registered_address as RegisteredAddress | null;
      setStreet(addr?.street ?? '');
      setCity(addr?.city ?? '');
      setPostalCode(addr?.postal_code ?? '');
      setStateCode((addressData.state_code as string) ?? '');
    }
  }, [addressData]);

  // Update VAT status mutation
  const updateVatMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!merchant?.id) throw new Error('No merchant found');

      const { error } = await supabase
        .from('merchants')
        .update({
          vat_registration_status: enabled ? 'registered' : 'not_registered',
        })
        .eq('id', merchant.id);

      if (error) throw error;
      return enabled;
    },
    onMutate: async (enabled) => {
      // Optimistic update
      setVatEnabled(enabled);
    },
    onSuccess: (enabled) => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      Alert.alert(
        'Success',
        enabled
          ? 'VAT has been enabled. 7.5% VAT will be applied to all orders.'
          : 'VAT has been disabled.'
      );
    },
    onError: (_error, enabled) => {
      // Revert on error
      setVatEnabled(!enabled);
      Alert.alert('Error', 'Failed to update VAT settings. Please try again.');
    },
  });

  // Save TIN mutation
  const saveTinMutation = useMutation({
    mutationFn: async (tin: string) => {
      if (!merchant?.id) throw new Error('No merchant found');
      if (tin && !/^\d{10}$/.test(tin)) {
        throw new Error('Nigerian TIN must be exactly 10 digits');
      }
      const { error } = await supabase
        .from('merchants')
        .update({ tax_identification_number: tin || null })
        .eq('id', merchant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      Alert.alert('Success', 'Tax Identification Number saved.');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  // Save legal entity name mutation
  const saveLegalEntityMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!merchant?.id) throw new Error('No merchant found');
      const { error } = await supabase
        .from('merchants')
        .update({ legal_entity_name: name || null })
        .eq('id', merchant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant'] });
      Alert.alert('Success', 'Legal entity name saved.');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save legal entity name.');
    },
  });

  // Save registered address mutation
  const saveAddressMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id) throw new Error('No merchant found');
      const selectedState = NIGERIAN_STATES.find((s) => s.code === stateCode);
      const { error } = await supabase
        .from('merchants')
        .update({
          registered_address: {
            street: street || null,
            city: city || null,
            state: selectedState?.name || null,
            postal_code: postalCode || null,
            country: 'Nigeria',
          },
          state_code: stateCode || null,
        })
        .eq('id', merchant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-address'] });
      Alert.alert('Success', 'Registered business address saved.');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to save address. Please try again.');
    },
  });

  const handleToggleVat = () => {
    const newValue = !vatEnabled;

    Alert.alert(
      newValue ? 'Enable VAT?' : 'Disable VAT?',
      newValue
        ? '7.5% VAT will be added to all orders. Make sure you are registered with FIRS before enabling.'
        : 'VAT will no longer be applied to orders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newValue ? 'Enable' : 'Disable',
          style: newValue ? 'default' : 'destructive',
          onPress: () => updateVatMutation.mutate(newValue),
        },
      ]
    );
  };

  const selectedStateName =
    NIGERIAN_STATES.find((s) => s.code === stateCode)?.name ?? '';

  React.useEffect(() => {
    if (merchant) {
      setVatEnabled(merchant.vat_registration_status === 'registered');
      setTaxId(merchant.tax_identification_number ?? '');
      setLegalEntityName(merchant.legal_entity_name ?? '');
    }
  }, [
    merchant,
    merchant?.vat_registration_status,
    merchant?.tax_identification_number,
    merchant?.legal_entity_name,
  ]);

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
          title: 'Tax Settings',
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
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
          showsVerticalScrollIndicator={false}
        >
          {/* VAT Status Card */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: vatEnabled
                      ? colors.successLight
                      : colors.cardHover,
                  },
                ]}
              >
                <Ionicons
                  name="receipt-outline"
                  size={24}
                  color={vatEnabled ? colors.success : colors.textSecondary}
                />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  VAT Collection
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: vatEnabled
                        ? colors.successLight
                        : colors.cardHover,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: vatEnabled
                          ? colors.success
                          : colors.textMuted,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: vatEnabled ? colors.success : colors.textMuted },
                    ]}
                  >
                    {vatEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            {/* Toggle Row */}
            <Pressable
              style={styles.toggleRow}
              onPress={handleToggleVat}
              disabled={updateVatMutation.isPending}
            >
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  Charge 7.5% VAT
                </Text>
                <Text
                  style={[
                    styles.toggleDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  Applied to all orders at checkout
                </Text>
              </View>
              <View style={styles.toggleContainer}>
                {updateVatMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View
                    style={[
                      styles.toggle,
                      vatEnabled && styles.toggleActive,
                      {
                        backgroundColor: vatEnabled
                          ? colors.success
                          : colors.cardHover,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleThumb,
                        vatEnabled && styles.toggleThumbActive,
                      ]}
                    />
                  </View>
                )}
              </View>
            </Pressable>
          </View>

          {/* VAT Rate Info */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                VAT Rate
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                7.5%
              </Text>
            </View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                Country
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                Nigeria
              </Text>
            </View>
          </View>

          {/* TIN Card */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: colors.cardHover },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={colors.textSecondary}
                />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Tax Identification Number
                </Text>
                <Text
                  style={[
                    styles.toggleDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  Your 10-digit FIRS TIN
                </Text>
              </View>
            </View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <TextInput
              style={[
                styles.textInput,
                {
                  color: colors.text,
                  backgroundColor: colors.cardHover,
                  borderColor: colors.border,
                },
              ]}
              placeholder="1234567890"
              placeholderTextColor={colors.textMuted}
              value={taxId}
              onChangeText={(text) =>
                setTaxId(text.replace(/\D/g, '').slice(0, 10))
              }
              keyboardType="number-pad"
              maxLength={10}
            />
            <Pressable
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={() => saveTinMutation.mutate(taxId)}
              disabled={saveTinMutation.isPending}
            >
              {saveTinMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save TIN</Text>
              )}
            </Pressable>
          </View>

          {/* Legal Entity Name Card */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: colors.cardHover },
                ]}
              >
                <Ionicons
                  name="business-outline"
                  size={24}
                  color={colors.textSecondary}
                />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Legal Entity Name
                </Text>
                <Text
                  style={[
                    styles.toggleDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  Registered name on CAC documents
                </Text>
              </View>
            </View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <TextInput
              style={[
                styles.textInput,
                {
                  color: colors.text,
                  backgroundColor: colors.cardHover,
                  borderColor: colors.border,
                },
              ]}
              placeholder="e.g. Acme Enterprises Limited"
              placeholderTextColor={colors.textMuted}
              value={legalEntityName}
              onChangeText={setLegalEntityName}
            />
            <Pressable
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={() => saveLegalEntityMutation.mutate(legalEntityName)}
              disabled={saveLegalEntityMutation.isPending}
            >
              {saveLegalEntityMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>

          {/* Registered Address Card */}
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <View style={styles.cardHeader}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: colors.cardHover },
                ]}
              >
                <Ionicons
                  name="location-outline"
                  size={24}
                  color={colors.textSecondary}
                />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Registered Business Address
                </Text>
                <Text
                  style={[
                    styles.toggleDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  Official address for tax invoices
                </Text>
              </View>
            </View>
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Street Address
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  color: colors.text,
                  backgroundColor: colors.cardHover,
                  borderColor: colors.border,
                },
              ]}
              placeholder="e.g. 123 Marina Road"
              placeholderTextColor={colors.textMuted}
              value={street}
              onChangeText={setStreet}
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  City
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.cardHover,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="e.g. Lagos"
                  placeholderTextColor={colors.textMuted}
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={styles.halfField}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  Postal Code
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.cardHover,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="e.g. 100001"
                  placeholderTextColor={colors.textMuted}
                  value={postalCode}
                  onChangeText={setPostalCode}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              State
            </Text>
            <Pressable
              style={[
                styles.stateSelector,
                {
                  backgroundColor: colors.cardHover,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setShowStateModal(true)}
            >
              <Text
                style={[
                  styles.stateSelectorText,
                  {
                    color: selectedStateName ? colors.text : colors.textMuted,
                  },
                ]}
              >
                {selectedStateName || 'Select state...'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>

            <Pressable
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={() => saveAddressMutation.mutate()}
              disabled={saveAddressMutation.isPending}
            >
              {saveAddressMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Address</Text>
              )}
            </Pressable>
          </View>

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
              VAT is automatically calculated and shown separately on invoices.
              Ensure you are registered with FIRS before enabling VAT
              collection.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* State Picker Modal */}
      <Modal
        visible={showStateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowStateModal(false)}
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
              Select State
            </Text>
            <Pressable
              onPress={() => setShowStateModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={NIGERIAN_STATES}
            keyExtractor={(item) => item.code}
            contentContainerStyle={{ padding: SPACING.md }}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.stateItem,
                  {
                    backgroundColor:
                      stateCode === item.code
                        ? colors.primaryLight
                        : colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  setStateCode(item.code);
                  setShowStateModal(false);
                }}
              >
                <Text
                  style={[
                    styles.stateItemText,
                    {
                      color:
                        stateCode === item.code ? colors.primary : colors.text,
                    },
                  ]}
                >
                  {item.name}
                </Text>
                {stateCode === item.code && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.primary}
                  />
                )}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING['3xl'],
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  divider: {
    height: 1,
    marginVertical: SPACING.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  toggleContainer: {
    width: 52,
    height: 32,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {},
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  infoLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  infoValue: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  noticeText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.sm,
  },
  saveButton: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: 44,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  fieldLabel: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  halfField: {
    flex: 1,
  },
  stateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    height: 44,
  },
  stateSelectorText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  stateItemText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
});
