import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import {
  getCustomerDisplayContact,
  getCustomerDisplayInitial,
  getCustomerDisplayName,
  MODAL_FLATLIST_PROPS,
} from './new-order.shared';
import { styles } from './new-order.styles';

interface NewOrderCustomerSearchViewProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderCustomerSearchView({
  controller,
}: NewOrderCustomerSearchViewProps) {
  const {
    colors,
    customerSearch,
    customersData,
    customersQuery,
    handleSelectCustomer,
    setCustomerSearch,
    setIsCreatingCustomer,
  } = controller;
  const customerRows =
    customersData?.pages.flatMap((page) => page.customers) || [];
  const emptyMessage = customersQuery.isLoading
    ? 'Loading customers...'
    : customersQuery.isError
      ? customersQuery.error instanceof Error
        ? customersQuery.error.message
        : 'Failed to load customers'
      : 'No customers found';

  return (
    <>
      <View style={[styles.searchBox, { backgroundColor: colors.cardHover }]}>
        <Ionicons color={colors.textMuted} name="search" size={20} />
        <TextInput
          onChangeText={setCustomerSearch}
          placeholder="Search name, email, or phone..."
          placeholderTextColor={colors.textMuted}
          style={{ color: colors.text, flex: 1, marginLeft: 8 }}
          value={customerSearch}
        />
      </View>

      <Pressable
        accessibilityLabel="Create new customer"
        accessibilityRole="button"
        onPress={() => setIsCreatingCustomer(true)}
        style={[
          styles.listRow,
          { borderBottomColor: colors.border, borderBottomWidth: 1 },
        ]}
      >
        <View
          style={[styles.iconBox, { backgroundColor: `${colors.primary}20` }]}
        >
          <Ionicons color={colors.primary} name="person-add" size={18} />
        </View>
        <Text
          style={[styles.listLabel, { color: colors.primary, fontSize: 16 }]}
        >
          Create new customer
        </Text>
      </Pressable>

      <FlatList
        {...MODAL_FLATLIST_PROPS}
        contentContainerStyle={{ paddingBottom: 40 }}
        data={customerRows}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 32 }}>
            <Text style={{ color: colors.textMuted }}>{emptyMessage}</Text>
          </View>
        }
        ListFooterComponent={
          customersQuery.hasNextPage ? (
            <View style={{ padding: 16 }}>
              {customersQuery.isFetchingNextPage ? (
                <Text style={{ color: colors.textMuted, textAlign: 'center' }}>
                  Loading more customers...
                </Text>
              ) : (
                <Pressable
                  accessibilityLabel="Load more customers"
                  accessibilityRole="button"
                  onPress={() => {
                    void customersQuery.fetchNextPage();
                  }}
                  style={[
                    styles.actionBtn,
                    {
                      alignSelf: 'center',
                      backgroundColor: colors.backgroundLight,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Load more
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Select customer ${getCustomerDisplayName(item)}`}
            accessibilityRole="button"
            onPress={() => handleSelectCustomer(item)}
            style={[
              styles.listRow,
              {
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
                paddingVertical: 12,
              },
            ]}
          >
            <View
              style={[styles.iconBox, { backgroundColor: colors.cardHover }]}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 14,
                  fontWeight: 'bold',
                }}
              >
                {getCustomerDisplayInitial(item)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>
                {getCustomerDisplayName(item)}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {getCustomerDisplayContact(item)}
              </Text>
            </View>
            {item.total_orders > 0 ? (
              <View
                style={[
                  styles.qtyBadge,
                  { backgroundColor: `${colors.success}20` },
                ]}
              >
                <Text style={{ color: colors.success, fontSize: 12 }}>
                  {item.total_orders} orders
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </>
  );
}
