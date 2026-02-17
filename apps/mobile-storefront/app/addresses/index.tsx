/**
 * Address Book Screen
 * Manage saved delivery addresses
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type AlertButton,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { BRAND } from '@/constants/Colors';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('Addresses');

interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code?: string;
  is_default: boolean;
  created_at: string;
}

export default function AddressesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const user = useAuthStore((state) => state.user);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const _settingDefaultRef = useRef(false);

  const fetchAddresses = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('customer_addresses')
        .select(
          'id, label, name, phone, address, city, state, postal_code, is_default, created_at'
        )
        .eq('customer_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setAddresses(data || []);
      setError(null);
    } catch (err) {
      log.error('Error fetching addresses:', err);
      setError('Failed to load addresses');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAddresses();
  };

  const handleSetDefault = async (addressId: string) => {
    // Guard against double-tap race condition
    if (_settingDefaultRef.current || !user?.id) return;
    _settingDefaultRef.current = true;

    try {
      // Clear all existing defaults for this customer first
      const { error: clearError } = await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', user.id)
        .neq('id', addressId);

      if (clearError) {
        log.error('Failed to clear old defaults:', clearError);
        // Non-fatal: proceed to set the new default
      }

      // Set the new default, scoped to customer_id for security
      const { error: setDefaultError } = await supabase
        .from('customer_addresses')
        .update({ is_default: true })
        .eq('id', addressId)
        .eq('customer_id', user.id);

      if (setDefaultError) throw setDefaultError;

      // Refresh the list
      fetchAddresses();
    } catch (err) {
      log.error('Error setting default address:', err);
      Alert.alert('Error', 'Failed to set default address');
    } finally {
      _settingDefaultRef.current = false;
    }
  };

  const handleDeleteAddress = (address: Address) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete "${address.label || 'this address'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error: deleteError } = await supabase
                .from('customer_addresses')
                .delete()
                .eq('id', address.id)
                .eq('customer_id', user?.id);

              if (deleteError) throw deleteError;

              setAddresses((prev) => prev.filter((a) => a.id !== address.id));
            } catch (err) {
              log.error('Error deleting address:', err);
              Alert.alert('Error', 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const renderAddressCard = ({ item }: { item: Address }) => (
    <View style={[styles.addressCard, { backgroundColor: colors.card }]}>
      <View style={styles.addressHeader}>
        <View style={styles.labelContainer}>
          <Ionicons
            name={item.label === 'Home' ? 'home-outline' : 'business-outline'}
            size={18}
            color={BRAND.primary}
          />
          <Text style={[styles.addressLabel, { color: colors.text }]}>
            {item.label || 'Address'}
          </Text>
          {item.is_default && (
            <View
              style={[
                styles.defaultBadge,
                { backgroundColor: `${BRAND.primary}20` },
              ]}
            >
              <Text style={[styles.defaultText, { color: BRAND.primary }]}>
                Default
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            // 2026 Critical Fix: Properly type Alert buttons without 'as any'
            const buttons: AlertButton[] = [
              {
                text: 'Edit',
                onPress: () => router.push(`/addresses/${item.id}`),
              },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => handleDeleteAddress(item),
              },
              { text: 'Cancel', style: 'cancel' },
            ];
            // Conditionally add "Set as Default" if not already default
            if (!item.is_default) {
              buttons.splice(1, 0, {
                text: 'Set as Default',
                onPress: () => handleSetDefault(item.id),
              });
            }
            Alert.alert('Address Options', '', buttons);
          }}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.addressContent}>
        <Text style={[styles.addressName, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.addressPhone, { color: colors.textSecondary }]}>
          {item.phone}
        </Text>
        <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
          {item.address}
        </Text>
        <Text style={[styles.addressLine, { color: colors.textSecondary }]}>
          {item.city}, {item.state}
          {item.postal_code ? ` ${item.postal_code}` : ''}
        </Text>
      </View>

      <View style={styles.addressActions}>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.border }]}
          onPress={() => router.push(`/addresses/${item.id}`)}
        >
          <Ionicons name="create-outline" size={16} color={colors.text} />
          <Text style={[styles.actionText, { color: colors.text }]}>Edit</Text>
        </TouchableOpacity>
        {!item.is_default && (
          <TouchableOpacity
            style={[styles.actionButton, { borderColor: BRAND.primary }]}
            onPress={() => handleSetDefault(item.id)}
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={BRAND.primary}
            />
            <Text style={[styles.actionText, { color: BRAND.primary }]}>
              Set Default
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons
        name="location-outline"
        size={64}
        color={colors.textSecondary}
      />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No saved addresses
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Add an address for faster checkout
      </Text>
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: BRAND.primary }]}
        onPress={() => router.push('/addresses/new')}
      >
        <Ionicons name="add" size={20} color="#FFF" />
        <Text style={styles.addButtonText}>Add Address</Text>
      </TouchableOpacity>
    </View>
  );

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Ionicons
            name="person-outline"
            size={64}
            color={colors.textSecondary}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Sign in required
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Sign in to manage your addresses
          </Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: BRAND.primary }]}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.addButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
        <TouchableOpacity onPress={fetchAddresses}>
          <Text style={[styles.retryText, { color: BRAND.primary }]}>
            Tap to retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={addresses}
        renderItem={renderAddressCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          addresses.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
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

      {addresses.length > 0 && (
        <TouchableOpacity
          style={[styles.floatingButton, { backgroundColor: BRAND.primary }]}
          onPress={() => router.push('/addresses/new')}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 80,
  },
  emptyListContent: {
    flex: 1,
  },
  addressCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultText: {
    fontSize: 11,
    fontWeight: '600',
  },
  menuButton: {
    padding: 4,
  },
  addressContent: {
    marginBottom: 12,
  },
  addressName: {
    fontSize: 15,
    fontWeight: '500',
  },
  addressPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  addressLine: {
    fontSize: 14,
    marginTop: 2,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E5',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  errorText: {
    fontSize: 16,
    marginTop: 12,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
});
