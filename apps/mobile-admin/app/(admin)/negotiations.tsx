import {
  buildTelLink,
  buildWhatsAppLink,
  type NegotiationCartLine,
} from '@baci/shared';
import Ionicons from '@react-native-vector-icons/ionicons';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BRAND, palette, RADIUS, SHADOWS, SPACING } from '@/constants/Colors';
import { useMerchant } from '@/hooks/useMerchant';
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
  cart_snapshot: NegotiationCartLine[] | null;
  customer_phone: string | null;
  created_at: string;
  evidence_url?: string;
}

const NEGOTIATION_EVIDENCE_BUCKET = 'negotiation-evidence';
const EVIDENCE_SIGNED_URL_TTL_SECONDS = 60 * 60;

// Module-scope helpers keep try/throw out of the component body so React
// Compiler can memoize the screen (try/finally + throw-in-try are bailouts).
async function loadNegotiationRequests(
  merchantId: string
): Promise<NegotiationRequest[]> {
  // NOTE: `negotiation_requests` has no top-level `current_price` column —
  // selecting it returns a 400 ("column does not exist") and breaks the whole
  // screen. The pre-offer price lives in `item_info.current_price` (single-item
  // offers only); whole-cart "total" offers carry no per-item price. Derive the
  // display price from item_info so the query stays valid.
  const { data, error } = await supabase
    .from('negotiation_requests')
    .select(
      'id, customer_id, type, status, offered_price, item_info, cart_snapshot, customer_phone, created_at, evidence_url'
    )
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    current_price: row.item_info?.current_price ?? null,
  })) as NegotiationRequest[];
}

async function updateNegotiationStatus(
  id: string,
  status: 'accepted' | 'rejected',
  merchantId: string
): Promise<void> {
  const { error } = await supabase
    .from('negotiation_requests')
    .update({ status })
    .eq('id', id)
    .eq('merchant_id', merchantId);

  if (error) throw error;
}

// Open a link in the OS handler (browser, dialer, WhatsApp). Best-effort: an
// unsupported or malformed URL surfaces a friendly alert instead of throwing.
async function openExternalUrl(url: string): Promise<void> {
  try {
    if (/^tel:/i.test(url)) {
      await Linking.openURL(url);
      return;
    }

    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Cannot open link', url);
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Cannot open link', url);
  }
}

function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isStorageObjectPath(value: string): boolean {
  return !value.includes('://') && value.includes('/') && value.length <= 1024;
}

// Customers attach evidence as a URL (competitor link), a durable Supabase
// Storage object path, or legacy placeholder text. Storage paths are private, so
// mint a fresh signed URL at view time; placeholders stay readable as text.
async function openEvidence(evidenceUrl: string): Promise<void> {
  if (isRemoteUrl(evidenceUrl)) {
    await openExternalUrl(evidenceUrl);
    return;
  }

  if (isStorageObjectPath(evidenceUrl)) {
    try {
      const { data, error } = await supabase.storage
        .from(NEGOTIATION_EVIDENCE_BUCKET)
        .createSignedUrl(evidenceUrl, EVIDENCE_SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        throw error ?? new Error('Missing signed URL');
      }
      await openExternalUrl(data.signedUrl);
    } catch {
      Alert.alert('Cannot open evidence', 'Unable to open the uploaded proof.');
    }
    return;
  }

  Alert.alert('Customer evidence', evidenceUrl);
}

// Short WhatsApp/SMS opener referencing the offer so the merchant doesn't have
// to retype context. Falls back to the item name or a generic cart label.
function buildFollowUpMessage(request: NegotiationRequest): string {
  const item = request.item_info?.name ?? 'your cart';
  return `Hi! About your negotiation offer on ${item} — `;
}

export default function NegotiationsScreen() {
  const { merchant } = useMerchant();
  const [requests, setRequests] = useState<NegotiationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 2026 Best Practice: Removed useCallback wrapper as React Compiler handles memoization (ADR-004)
  // setState happens only inside promise callbacks (never synchronously), so
  // calling this from the mount effect cannot trigger cascading renders.
  const fetchRequests = () => {
    const merchantId = merchant?.id;
    if (!merchantId) {
      // Clear merchant-scoped state so a sign-out / merchant switch can't leave
      // the previous merchant's negotiations on screen, then settle the flags.
      return Promise.resolve().then(() => {
        setRequests([]);
        setFetchError(null);
        setLoading(false);
        setRefreshing(false);
      });
    }
    return loadNegotiationRequests(merchantId)
      .then((data) => {
        setRequests(data);
        setFetchError(null);
      })
      .catch((err: unknown) => {
        console.error('Error fetching negotiations:', err);
        setFetchError('Failed to load negotiations');
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: this effect is intentionally keyed by merchant ID; fetchRequests is recreated each render and would resubscribe continuously.
  useEffect(() => {
    const merchantId = merchant?.id;

    // fetchRequests resolves the loading/refreshing flags inside promise
    // callbacks (never synchronously), so calling it here avoids the
    // set-state-in-effect cascade. Its no-merchant branch defers the flag reset
    // and skips the network call, matching the prior early-return behavior.
    fetchRequests();

    if (!merchantId) {
      return;
    }

    // Supabase Realtime supports Postgres change filters; scope by merchant to
    // avoid refetching every connected merchant on unrelated inserts.
    const channel = supabase
      .channel(`negotiation_updates:${merchantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'negotiation_requests',
          filter: `merchant_id=eq.${merchantId}`,
        },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // fetchRequests is recreated every render; subscribing on merchant ID is the
    // intended boundary for this realtime channel.
  }, [merchant?.id]);

  const handleAction = async (id: string, status: 'accepted' | 'rejected') => {
    if (actionLoadingId) return; // Prevent double-submit
    if (!merchant?.id) {
      Alert.alert('Error', 'Merchant not found');
      return;
    }
    setActionLoadingId(id);
    // Capture before state update to avoid stale closure after fetchRequests()
    const negotiation = requests.find((r) => r.id === id);
    try {
      await updateNegotiationStatus(id, status, merchant.id);
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
    }
    setActionLoadingId(null);
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

      {item.cart_snapshot && item.cart_snapshot.length > 0 ? (
        <View style={styles.cartSection}>
          <Pressable
            style={styles.cartToggle}
            onPress={() =>
              setExpandedId((current) => (current === item.id ? null : item.id))
            }
            accessibilityRole="button"
            accessibilityLabel={
              expandedId === item.id
                ? 'Hide cart items'
                : `View ${item.cart_snapshot.length} cart items`
            }
          >
            <Ionicons name="cart-outline" size={16} color={palette.gray[600]} />
            <Text style={styles.cartToggleText}>
              {expandedId === item.id
                ? 'Hide items'
                : `View ${item.cart_snapshot.length} ${
                    item.cart_snapshot.length === 1 ? 'item' : 'items'
                  }`}
            </Text>
            <Ionicons
              name={expandedId === item.id ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={palette.gray[600]}
            />
          </Pressable>

          {expandedId === item.id ? (
            <View style={styles.cartItems}>
              {item.cart_snapshot.map((line, index) => (
                <View
                  key={`${line.product_id}-${line.variant_id ?? index}`}
                  style={styles.cartLine}
                >
                  <Text style={styles.cartLineQty}>{line.quantity}×</Text>
                  <View style={styles.cartLineBody}>
                    <Text style={styles.cartLineName} numberOfLines={2}>
                      {line.name}
                    </Text>
                    {line.variant_name || line.condition ? (
                      <Text style={styles.cartLineMeta} numberOfLines={1}>
                        {[line.variant_name, line.condition]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.cartLinePrice}>
                    {formatPrice(line.price * line.quantity)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {item.evidence_url ? (
        <Pressable
          style={styles.evidenceButton}
          onPress={() => void openEvidence(item.evidence_url as string)}
          accessibilityRole="button"
          accessibilityLabel="View customer evidence"
        >
          <Ionicons
            name="image-outline"
            size={16}
            color={palette.blue?.[500] || '#3B82F6'}
          />
          <Text style={styles.evidenceText}>View customer evidence</Text>
        </Pressable>
      ) : null}

      {item.customer_phone ? (
        <View style={styles.contactRow}>
          {buildTelLink(item.customer_phone) ? (
            <Pressable
              style={[styles.contactButton, styles.callButton]}
              onPress={() =>
                openExternalUrl(buildTelLink(item.customer_phone) as string)
              }
              accessibilityRole="button"
              accessibilityLabel="Call customer"
            >
              <Ionicons name="call" size={16} color={palette.gray[700]} />
              <Text style={styles.callButtonText}>Call</Text>
            </Pressable>
          ) : null}
          {buildWhatsAppLink(
            item.customer_phone,
            buildFollowUpMessage(item)
          ) ? (
            <Pressable
              style={[styles.contactButton, styles.whatsappButton]}
              onPress={() =>
                openExternalUrl(
                  buildWhatsAppLink(
                    item.customer_phone,
                    buildFollowUpMessage(item)
                  ) as string
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Message customer on WhatsApp"
            >
              <Ionicons name="logo-whatsapp" size={16} color={palette.white} />
              <Text style={styles.whatsappButtonText}>WhatsApp</Text>
            </Pressable>
          ) : null}
        </View>
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
        extraData={expandedId}
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
  cartSection: {
    marginBottom: SPACING.md,
  },
  cartToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.xs,
  },
  cartToggleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray[600],
  },
  cartItems: {
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: palette.gray[100],
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cartLineQty: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.gray[500],
    minWidth: 28,
  },
  cartLineBody: {
    flex: 1,
  },
  cartLineName: {
    fontSize: 13,
    fontWeight: '500',
    color: palette.gray[900],
  },
  cartLineMeta: {
    fontSize: 11,
    color: palette.gray[500],
    marginTop: 2,
  },
  cartLinePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.gray[700],
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
  contactRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: SPACING.md,
  },
  contactButton: {
    flex: 1,
    height: 40,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  callButton: {
    borderWidth: 1,
    borderColor: palette.gray[200],
  },
  callButtonText: {
    color: palette.gray[700],
    fontWeight: '600',
    fontSize: 13,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  whatsappButtonText: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 13,
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
