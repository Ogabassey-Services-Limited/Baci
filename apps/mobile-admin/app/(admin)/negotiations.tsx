import {
  buildTelLink,
  buildWhatsAppLink,
  type NegotiationCartLine,
  type NegotiationItemInfo,
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
import { useTheme } from '@/hooks/useTheme';
import { apiClient } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import { formatCurrency as formatPrice } from '@/utils/format';

type NegotiationStatus = 'pending' | 'accepted' | 'rejected' | 'countered';

interface NegotiationRequest {
  id: string;
  customer_id: string | null;
  type: 'single' | 'total';
  status: NegotiationStatus;
  offered_price: number;
  current_price: number | null;
  item_info: NegotiationItemInfo | null;
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
    // cart_snapshot is arbitrary client-supplied JSONB; coerce anything that
    // isn't an array to null so one malformed row can't crash the list on .map.
    cart_snapshot: Array.isArray(row.cart_snapshot) ? row.cart_snapshot : null,
    current_price: row.item_info?.current_price ?? null,
  })) as NegotiationRequest[];
}

async function updateNegotiationStatus(
  id: string,
  status: 'accepted' | 'rejected',
  merchantId: string
): Promise<void> {
  // Scope to still-pending rows so we don't clobber a decision another admin
  // already made. `.select()` returns the affected rows: zero means the request
  // was no longer pending, which must surface as an error rather than a silent
  // "success" (which would fire success haptics + notify the customer).
  const { data, error } = await supabase
    .from('negotiation_requests')
    .update({ status })
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .eq('status', 'pending')
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error('This request was already handled. Pull to refresh.');
  }
}

// Open a link in the OS handler (browser, dialer, WhatsApp). Best-effort: an
// unsupported or malformed URL surfaces a friendly alert instead of throwing.
async function openExternalUrl(url: string): Promise<void> {
  try {
    if (/^tel:/i.test(url)) {
      await Linking.openURL(url);
      return;
    }

    if (isRemoteUrl(url)) {
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

// Uploaded evidence is stored as `<merchantId>/<timestamp>-<rand>.<ext>` (see
// uploadNegotiationEvidence). Match that exact shape — a first path segment with
// no domain dot plus one image filename — so a scheme-less competitor image like
// `www.example.com/image.png` is NOT mistaken for a private Storage object.
const STORAGE_OBJECT_PATH =
  /^[^/\s:.]+\/[^/\s]+\.(?:png|jpe?g|webp|heic|heif)$/i;

function isStorageObjectPath(value: string): boolean {
  return value.length <= 1024 && STORAGE_OBJECT_PATH.test(value);
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
      // Signing failed (expired bucket policy, deleted object, …). Don't dead-end
      // the merchant — show the raw value so they can still read what was sent.
      Alert.alert('Customer evidence', evidenceUrl);
    }
    return;
  }

  Alert.alert('Customer evidence', evidenceUrl);
}

// Short WhatsApp/SMS opener referencing the offer so the merchant doesn't have
// to retype context. Falls back to the item name or a generic cart label.
function formatNegotiationStatus(status: NegotiationStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function buildFollowUpMessage(request: NegotiationRequest): string {
  const item = request.item_info?.name ?? 'your cart';
  return `Hi! About your negotiation offer on ${item} — `;
}

export default function NegotiationsScreen() {
  const { merchant, isLoading: isMerchantLoading } = useMerchant();
  const { colors } = useTheme();
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
      if (isMerchantLoading) {
        return Promise.resolve();
      }
      // Clear merchant-scoped state so a sign-out / merchant switch can't leave
      // the previous merchant's negotiations on screen, then settle the flags.
      return Promise.resolve().then(() => {
        setRequests([]);
        setFetchError(null);
        setLoading(false);
        setRefreshing(false);
      });
    }
    if (!refreshing) {
      setLoading(true);
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: this effect is intentionally keyed by merchant ID and loading state; fetchRequests is recreated each render and would resubscribe continuously.
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
          event: '*',
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
  }, [merchant?.id, isMerchantLoading]);

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
      await fetchRequests();
    }
    setActionLoadingId(null);
  };

  const renderItem = ({ item }: { item: NegotiationRequest }) => (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
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
        <Text style={[styles.dateText, { color: colors.textSecondary }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
        {item.item_info?.name ?? 'Cart Negotiation'}
      </Text>

      <View style={[styles.priceRow, { backgroundColor: colors.backgroundLight }]}>
        {item.current_price != null && (
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Current</Text>
            <Text style={[styles.oldPrice, { color: colors.textSecondary }]}>
              {formatPrice(item.current_price)}
            </Text>
          </View>
        )}
        {item.current_price != null && (
          <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
        )}
        <View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Offered</Text>
          <Text style={[styles.newPrice, { color: colors.primary }]}>{formatPrice(item.offered_price)}</Text>
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
            <Ionicons name="cart-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.cartToggleText, { color: colors.textSecondary }]}>
              {expandedId === item.id
                ? 'Hide items'
                : `View ${item.cart_snapshot.length} ${
                    item.cart_snapshot.length === 1 ? 'item' : 'items'
                  }`}
            </Text>
            <Ionicons
              name={expandedId === item.id ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </Pressable>

          {expandedId === item.id ? (
            <View style={[styles.cartItems, { borderTopColor: colors.border }]}>
              {item.cart_snapshot.map((line, index) => (
                <View
                  key={`${line.product_id}-${line.variant_id ?? index}`}
                  style={styles.cartLine}
                >
                  <Text style={[styles.cartLineQty, { color: colors.textSecondary }]}>{line.quantity}×</Text>
                  <View style={styles.cartLineBody}>
                    <Text style={[styles.cartLineName, { color: colors.text }]} numberOfLines={2}>
                      {line.name}
                    </Text>
                    {line.variant_name || line.condition ? (
                      <Text style={[styles.cartLineMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                        {[line.variant_name, line.condition]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.cartLinePrice, { color: colors.text }]}>
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
            color={colors.primary}
          />
          <Text style={[styles.evidenceText, { color: colors.primary }]}>View customer evidence</Text>
        </Pressable>
      ) : null}

      {item.customer_phone ? (
        <View style={styles.contactRow}>
          {buildTelLink(item.customer_phone) ? (
            <Pressable
              style={[styles.contactButton, styles.callButton, { borderColor: colors.border }]}
              onPress={() =>
                openExternalUrl(buildTelLink(item.customer_phone) as string)
              }
              accessibilityRole="button"
              accessibilityLabel="Call customer"
            >
              <Ionicons name="call" size={16} color={colors.text} />
              <Text style={[styles.callButtonText, { color: colors.text }]}>Call</Text>
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

      {item.status === 'pending' ? (
        <View style={styles.actionRow}>
          <Pressable
            style={[
              styles.actionButton,
              styles.rejectButton,
              { borderColor: colors.border },
              actionLoadingId === item.id && styles.disabledButton,
            ]}
            onPress={() => handleAction(item.id, 'rejected')}
            disabled={actionLoadingId !== null}
          >
            {actionLoadingId === item.id ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={[styles.rejectButtonText, { color: colors.textSecondary }]}>Reject</Text>
            )}
          </Pressable>
          <Pressable
            style={[
              styles.actionButton,
              styles.acceptButton,
              { backgroundColor: colors.primary },
              actionLoadingId === item.id && styles.disabledButton,
            ]}
            onPress={() => handleAction(item.id, 'accepted')}
            disabled={actionLoadingId !== null}
          >
            {actionLoadingId === item.id ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={[styles.acceptButtonText, { color: colors.textOnPrimary }]}>Accept Offer</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.statusOutcomeRow}>
          <Text style={[styles.statusOutcomeLabel, { color: colors.textSecondary }]}>Status</Text>
          <View
            style={[
              styles.statusOutcomeBadge,
              item.status === 'accepted' && { backgroundColor: colors.successLight },
              item.status === 'rejected' && { backgroundColor: colors.errorLight },
              item.status === 'countered' && { backgroundColor: colors.warningLight },
            ]}
          >
            <Text
              style={[
                styles.statusOutcomeText,
                item.status === 'accepted' && { color: colors.success },
                item.status === 'rejected' && { color: colors.error },
                item.status === 'countered' && { color: colors.warning },
              ]}
            >
              {formatNegotiationStatus(item.status)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{fetchError}</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            fetchRequests();
          }}
        >
          <Ionicons name="refresh" size={18} color={colors.primary} />
          <Text style={[styles.retryText, { color: colors.primary }]}>Tap to retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
              color={colors.border}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Pending Negotiations</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
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
  statusOutcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusOutcomeLabel: {
    color: palette.gray[500],
    fontSize: 13,
    fontWeight: '600',
  },
  statusOutcomeBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusAcceptedBadge: {
    backgroundColor: palette.emerald[400],
  },
  statusRejectedBadge: {
    backgroundColor: palette.red[50],
  },
  statusCounteredBadge: {
    backgroundColor: palette.amber[100],
  },
  statusOutcomeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusAcceptedText: {
    color: palette.gray[950],
  },
  statusRejectedText: {
    color: palette.red[700],
  },
  statusCounteredText: {
    color: palette.amber[700],
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
