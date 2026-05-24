import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TransactionReconciliationItemCard } from '@/components/transactions/TransactionReconciliationItemCard';
import { styles } from '@/components/transactions/transaction-reconciliation-screen.styles';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';
import { useUnlinkedOrderItemReconciliation } from '@/hooks/useUnlinkedOrderItemReconciliation';
import { rankReconciliationCandidates } from '@/lib/transaction-reconciliation';

interface UnlinkedOrderRow {
  created_at: string;
  customer_name: string | null;
  id: string;
  order_number: string | null;
}

interface UnlinkedItemRow {
  id: string;
  name: string | null;
  orders: UnlinkedOrderRow | UnlinkedOrderRow[] | null;
  price: number | null;
  quantity: number | null;
}

function getJoinedOrder(value: UnlinkedItemRow['orders']) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default function TransactionReconciliationScreen() {
  const { colors, isDark } = useTheme();
  const { format: formatCurrency } = useCurrency();
  const {
    keepCustomMutation,
    linkItemMutation,
    productCandidatesQuery,
    unlinkedItemsQuery,
  } = useUnlinkedOrderItemReconciliation();
  const [actionError, setActionError] = useState<string | null>(null);

  const items = (unlinkedItemsQuery.data ?? []) as UnlinkedItemRow[];
  const products = productCandidatesQuery.data ?? [];
  const isLoading = unlinkedItemsQuery.isLoading || productCandidatesQuery.isLoading;
  const error = unlinkedItemsQuery.error ?? productCandidatesQuery.error;
  const isMutating = linkItemMutation.isPending || keepCustomMutation.isPending;

  const handleLink = async (
    itemId: string,
    productId: string,
    variantId: string | null
  ) => {
    try {
      setActionError(null);
      await linkItemMutation.mutateAsync({
        orderItemId: itemId,
        productId,
        variantId,
      });
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Could not link this transaction item.'
      );
    }
  };

  const handleKeepCustom = async (itemId: string) => {
    try {
      setActionError(null);
      await keepCustomMutation.mutateAsync({ orderItemId: itemId });
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : 'Could not keep this item as custom.'
      );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Match transaction items',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView
        edges={['bottom']}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        <ScrollView contentContainerStyle={styles.content}>
          <View
            style={[
              styles.heroCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Review unmatched transaction items
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Link sold custom rows back to the catalog, or mark them as custom
              so future analytics does not drift.
            </Text>
          </View>

          {actionError ? (
            <View
              style={[
                styles.feedbackCard,
                {
                  backgroundColor: `${colors.error}12`,
                  borderColor: `${colors.error}30`,
                },
              ]}
            >
              <Text style={[styles.feedbackText, { color: colors.error }]}>
                {actionError}
              </Text>
            </View>
          ) : null}

          {isLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : null}

          {error && !isLoading ? (
            <View style={styles.stateContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={30}
                color={colors.error}
              />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                Unable to load unmatched items.
              </Text>
              <Pressable
                accessibilityLabel="Retry unmatched item reconciliation"
	                accessibilityRole="button"
	                onPress={() => {
	                  void Promise.allSettled([
	                    unlinkedItemsQuery.refetch(),
	                    productCandidatesQuery.refetch(),
	                  ]);
	                }}
	                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    { color: colors.textOnPrimary },
                  ]}
                >
                  Try again
                </Text>
              </Pressable>
            </View>
          ) : null}

          {!isLoading && !error && items.length === 0 ? (
            <View style={styles.stateContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={30}
                color={colors.success}
              />
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                No unmatched transaction items.
              </Text>
            </View>
          ) : null}

          {!isLoading && !error
            ? items.map((item) => {
                const order = getJoinedOrder(item.orders);
                const itemName = item.name ?? 'Custom item';
                const itemPrice = Number(item.price ?? 0);
                const matches = rankReconciliationCandidates({
                  item: {
                    id: item.id,
                    name: itemName,
                    price: itemPrice,
                  },
                  products,
                });

                return (
                  <TransactionReconciliationItemCard
                    key={item.id}
                    colors={colors}
                    createdAt={order?.created_at}
                    customerName={order?.customer_name}
                    formatCurrency={formatCurrency}
                    isMutating={isMutating}
                    item={{
                      id: item.id,
                      name: itemName,
                      price: itemPrice,
                      quantity: Number(item.quantity ?? 1),
                    }}
                    matches={matches}
                    onKeepCustom={(itemId) => {
                      void handleKeepCustom(itemId);
                    }}
                    onLink={(input) => {
                      void handleLink(
                        input.itemId,
                        input.productId,
                        input.variantId
                      );
                    }}
                    orderNumber={order?.order_number}
                  />
                );
              })
            : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
