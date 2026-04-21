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
} from './constants';
import { styles } from './styles';
import type { Address } from './types';

const log = createLogger('Addresses');

async function fetchSavedAddresses(customerId: string, merchantId: string) {
  const { data, error: fetchError } = await supabase
    .from('customers')
    .select('saved_addresses')
    .eq('id', customerId)
    .eq('merchant_id', merchantId)
    .single();

  if (fetchError) {
    throw fetchError;
  }

  const parsed = Array.isArray(data?.saved_addresses)
    ? (data.saved_addresses as Address[])
    : [];
  const normalized = normalizeSavedAddresses(parsed);

  normalized.sort((a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0));

  return normalized;
}

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
  const settingDefaultRef = useRef(false);
  const fetchAddresses = async () => {
    if (!customer?.id || !merchantId) {
      setIsLoading(false);
      return;
    }

    try {
      const normalized = await fetchSavedAddresses(customer.id, merchantId);
      setAddresses(normalized);
      setError(null);
    } catch (fetchError) {
      log.error('Error fetching addresses:', fetchError);
      setError('Failed to load addresses');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadInitialAddresses = async () => {
      if (!customer?.id || !merchantId) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const normalized = await fetchSavedAddresses(customer.id, merchantId);
        if (!isMounted) {
          return;
        }
        setAddresses(normalized);
        setError(null);
      } catch (fetchError) {
        if (!isMounted) {
          return;
        }
        log.error('Error fetching addresses:', fetchError);
        setError('Failed to load addresses');
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void loadInitialAddresses();

    return () => {
      isMounted = false;
    };
  }, [customer?.id, merchantId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void fetchAddresses();
  };

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

      void fetchAddresses();
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
        <View
          style={[
            styles.container,
            styles.centered,
            { backgroundColor: colors.background },
          ]}
        >
          <ActivityIndicator size="large" color={BRAND.primary} />
        </View>
      ) : error ? (
        <View
          style={[
            styles.container,
            styles.centered,
            { backgroundColor: colors.background },
          ]}
        >
          <Text style={[styles.errorText, { color: colors.text }]}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => void fetchAddresses()}>
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
            <AddressEmptyState
              colors={colors}
              onAddPress={() => router.push('/addresses/new')}
            />
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
          onPress={() => {
            router.push('/addresses/new');
          }}
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
