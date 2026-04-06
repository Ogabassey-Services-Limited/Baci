import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BRAND, palette, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { apiClient } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { formatCurrency as formatPrice } from '@/utils/format';

interface NegotiationRequest {
  id: string;
  customer_id: string | null;
  type: 'single' | 'total';
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  offered_price: number;
  current_price: number | null;
  item_info: {
    name: string;
    image?: string;
    current_price?: number;
  } | null;
  created_at: string;
  evidence_url?: string;
}

export default function NegotiationsScreen() {
  const [requests, setRequests] = useState<NegotiationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // 2026 Best Practice: Removed useCallback wrapper as React Compiler handles memoization (ADR-004)
  const fetchRequests = async () => {
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from('negotiation_requests')
        .select(
          'id, customer_id, type, status, offered_price, current_price, item_info, created_at, evidence_url'
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching negotiations:', err);
      setFetchError('Failed to load negotiations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('negotiation_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'negotiation_requests' },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAction = async (id: string, status: 'accepted' | 'rejected') => {
    if (actionLoadingId) return; // Prevent double-submit
    setActionLoadingId(id);
    // Capture before state update to avoid stale closure after fetchRequests()
    const negotiation = requests.find((r) => r.id === id);
    try {
      const { error } = await supabase
        .from('negotiation_requests')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await fetchRequests();

      // Notify customer if they're authenticated
      if (negotiation?.customer_id) {
        try {
          await apiClient('/api/negotiations/notify', {
            method: 'POST',
            body: JSON.stringify({ negotiationId: id, status }),
          });
        } catch (notifyErr) {
          // Non-fatal: status update succeeded, but notification failed
          console.warn('Customer notification failed:', notifyErr);
        }
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const message =
        error instanceof Error ? error.message : `Failed to ${status} request`;
      Alert.alert('Error', message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderItem = ({ item }: { item: NegotiationRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.typeBadge,
            {
              backgroundColor:
                item.type === 'total' ? palette.amber[100] : palette.red[50],
            },
          ]}
        >
          <Text
            style={[
              styles.typeText,
              {
                color:
                  item.type === 'total' ? palette.amber[700] : palette.red[700],
              },
            ]}
          >
            {item.type === 'total' ? 'Bulk Cart' : 'Single Item'}
          </Text>
        </View>
        <Text style={styles.dateText}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      <Text style={styles.itemName} numberOfLines={1}>
        {item.item_info?.name ?? 'Cart Negotiation'}
      </Text>

      <View style={styles.priceRow}>
        {item.current_price != null && (
          <View>
            <Text style={styles.label}>Current</Text>
            <Text style={styles.oldPrice}>
              {formatPrice(item.current_price)}
            </Text>
          </View>
        )}
        {item.current_price != null && (
          <Ionicons name="arrow-forward" size={16} color={palette.gray[400]} />
        )}
        <View>
          <Text style={styles.label}>Offered</Text>
          <Text style={styles.newPrice}>{formatPrice(item.offered_price)}</Text>
        </View>
        {item.current_price != null &&
          item.current_price > 0 &&
          item.offered_price < item.current_price && (
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>
                -
                {Math.round(
                  (1 - item.offered_price / item.current_price) * 100
                )}
                %
              </Text>
            </View>
          )}
      </View>

      {item.evidence_url ? (
        <Pressable
          style={styles.evidenceButton}
          onPress={() =>
            Alert.alert(
              'Evidence',
              'Evidence image viewing pending implementation'
            )
          }
        >
          <Ionicons
            name="image-outline"
            size={16}
            color={palette.blue?.[500] || '#3B82F6'}
          />
          <Text style={styles.evidenceText}>Customer attached evidence</Text>
        </Pressable>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          style={[
            styles.actionButton,
            styles.rejectButton,
            actionLoadingId === item.id && styles.disabledButton,
          ]}
          onPress={() => handleAction(item.id, 'rejected')}
          disabled={actionLoadingId !== null}
        >
          {actionLoadingId === item.id ? (
            <ActivityIndicator size="small" color={palette.gray[600]} />
          ) : (
            <Text style={styles.rejectButtonText}>Reject</Text>
          )}
        </Pressable>
        <Pressable
          style={[
            styles.actionButton,
            styles.acceptButton,
            actionLoadingId === item.id && styles.disabledButton,
          ]}
          onPress={() => handleAction(item.id, 'accepted')}
          disabled={actionLoadingId !== null}
        >
          {actionLoadingId === item.id ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <Text style={styles.acceptButtonText}>Accept Offer</Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle" size={48} color={palette.red[400]} />
        <Text style={styles.emptyTitle}>{fetchError}</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            fetchRequests();
          }}
        >
          <Ionicons name="refresh" size={18} color={BRAND.primary} />
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={requests}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={100}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRequests();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={64}
              color={palette.gray[200]}
            />
            <Text style={styles.emptyTitle}>No Pending Negotiations</Text>
            <Text style={styles.emptySubtitle}>
              All quiet for now. New requests will appear here instantly.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.gray[50],
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 12,
    color: palette.gray[400],
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.gray[900],
    marginBottom: SPACING.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.sm,
    backgroundColor: palette.gray[50],
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 10,
    color: palette.gray[500],
    marginBottom: 2,
  },
  oldPrice: {
    fontSize: 14,
    color: palette.gray[500],
    textDecorationLine: 'line-through',
  },
  newPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: BRAND.primary,
  },
  savingsBadge: {
    backgroundColor: palette.red[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.red[700],
  },
  evidenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.md,
  },
  evidenceText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: palette.gray[200],
  },
  rejectButtonText: {
    color: palette.gray[600],
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: BRAND.primary,
  },
  acceptButtonText: {
    color: palette.white,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.gray[900],
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.gray[500],
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.primary,
  },
});
