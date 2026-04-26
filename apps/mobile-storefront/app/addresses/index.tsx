import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND, palette } from '@/constants/Colors';
import { useRequireAuth } from '@/hooks/use-auth-guard';
import { useStorefrontInsets } from '@/hooks/use-storefront-insets';
import { createLogger } from '@/lib/logger';
import { normalizeSavedAddresses } from '@/lib/saved-addresses';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import { AddressCard } from './AddressCard';
import { AddressEmptyState } from './AddressEmptyState';
import {
  ADDRESS_DELETE_PROMPT_TITLE,
  ADDRESS_EMPTY_ADD_ACTION_LABEL,
  ADDRESS_LIST_BOTTOM_PADDING,
} from '@/components/addresses/constants';
import { loadAddresses } from './load-addresses';
import { styles } from '@/components/addresses/styles';
import type { Address } from '@/components/addresses/types';

const log = createLogger('Addresses');

export default function AddressesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const customer = useAuthStore((state) => state.customer);
  const merchantId = useAuthStore((state) => state.merchantId);
  const { getListContentStyle } = useStorefrontInsets();
  const { isLoading: isAuthLoading, redirectTo } = useRequireAuth();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const settingDefaultRef = useRef(false);

  useEffect(() => {
    const customerId = customer?.id;
    const activeMerchantId = merchantId;

    isMountedRef.current = true;
    void loadAddresses({
      customerId,
      merchantId: activeMerchantId,
      isMountedRef,
      setAddresses,
      setError,
      setIsLoading,
      setIsRefreshing,
      settleLoading: true,
      settleRefreshing: true,
    });

    return () => {
      isMountedRef.current = false;
    };
  }, [customer?.id, merchantId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void loadAddresses({
      customerId: customer?.id,
      merchantId,
      isMountedRef,
      setAddresses,
      setError,
      setIsLoading,
      setIsRefreshing,
      settleRefreshing: true,
    });
  };

  const centeredContainerStyle = [
    styles.container,
    styles.centered,
    { backgroundColor: colors.background },
  ];
  const handleRetry = () =>
    void loadAddresses({
      customerId: customer?.id,
      merchantId,
      isMountedRef,
      setAddresses,
      setError,
      setIsLoading,
      setIsRefreshing,
      settleLoading: true,
      settleRefreshing: true,
    });
  const handleAddAddress = () => router.push('/addresses/new');

  const handleSetDefault = async (addressId: string) => {
    if (settingDefaultRef.current || !customer?.id || !merchantId) return;
    settingDefaultRef.current = true;

    try {
      const updated = addresses.map((address) => ({
        ...address,
        is_default: address.id === addressId,
      }));

      const { error: updateError } = await supabase
        .from('customers')
        .update({ saved_addresses: updated })
        .eq('id', customer.id)
        .eq('merchant_id', merchantId);

      if (updateError) throw updateError;

      void loadAddresses({
        customerId: customer.id,
        merchantId,
        isMountedRef,
        setAddresses,
        setError,
        setIsLoading,
        setIsRefreshing,
      });
    } catch (updateError) {
      log.error('Error setting default address:', updateError);
      Alert.alert('Error', 'Failed to set default address');
    } finally {
      settingDefaultRef.current = false;
    }
  };

  const handleDeleteAddress = (address: Address) => {
    Alert.alert(
      ADDRESS_DELETE_PROMPT_TITLE,
      `Are you sure you want to delete "${address.label || 'this address'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!customer?.id || !merchantId) {
              Alert.alert('Error', 'Please sign in to manage addresses');
              return;
            }
            try {
              const updated = addresses.filter(
                (item) => item.id !== address.id
              );
              const normalized = normalizeSavedAddresses(updated);
              const { error: deleteError } = await supabase
                .from('customers')
                .update({ saved_addresses: normalized })
                .eq('id', customer.id)
                .eq('merchant_id', merchantId);

              if (deleteError) throw deleteError;
              setAddresses(normalized);
            } catch (deleteError) {
              log.error('Error deleting address:', deleteError);
              Alert.alert('Error', 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  if (redirectTo) {
    return <Redirect href={redirectTo} />;
  }

  return (
    <StorefrontScreenShell
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          title: 'Addresses',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />

      {isAuthLoading || isLoading ? (
        <View style={centeredContainerStyle}>
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : error ? (
        <View style={centeredContainerStyle}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            {error}
          </Text>
          <TouchableOpacity onPress={handleRetry}>
            <Text style={[styles.retryText, { color: BRAND.primary }]}>
              Tap to retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={addresses}
          renderItem={({ item }) => (
            <AddressCard
              address={item}
              colors={colors}
              onDelete={handleDeleteAddress}
              onEdit={(address) => {
                router.push(`/addresses/${address.id}`);
              }}
              onSetDefault={handleSetDefault}
            />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            getListContentStyle({
              includeBottomInset: false,
              paddingBottom: ADDRESS_LIST_BOTTOM_PADDING,
            }),
            addresses.length === 0 && styles.emptyListContent,
          ]}
          ListEmptyComponent={
            <AddressEmptyState colors={colors} onAddPress={handleAddAddress} />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={BRAND.primary}
              colors={[BRAND.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {addresses.length > 0 ? (
        <TouchableOpacity
          style={[styles.floatingButton, { backgroundColor: BRAND.primary }]}
          accessibilityRole="button"
          accessibilityLabel={ADDRESS_EMPTY_ADD_ACTION_LABEL}
          onPress={handleAddAddress}
        >
          <Ionicons
            name="add"
            size={28}
            color={palette.white}
            accessible={false}
            importantForAccessibility="no"
          />
        </TouchableOpacity>
      ) : null}
    </StorefrontScreenShell>
  );
}
