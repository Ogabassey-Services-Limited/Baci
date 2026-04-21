import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { MODAL_FLATLIST_PROPS } from './new-order.shared';
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
    handleSelectCustomer,
    setCustomerSearch,
    setIsCreatingCustomer,
  } = controller;

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
        <View style={[styles.iconBox, { backgroundColor: `${colors.primary}20` }]}>
          <Ionicons color={colors.primary} name="person-add" size={18} />
        </View>
        <Text style={[styles.listLabel, { color: colors.primary, fontSize: 16 }]}>
          Create new customer
        </Text>
      </Pressable>

      <FlatList
        {...MODAL_FLATLIST_PROPS}
        contentContainerStyle={{ paddingBottom: 40 }}
        data={customersData?.pages.flatMap((page) => page.customers) || []}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ alignItems: 'center', padding: 32 }}>
            <Text style={{ color: colors.textMuted }}>No customers found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Select customer ${
              `${item.first_name || ''} ${item.last_name || ''}`.trim() ||
              item.email ||
              item.phone ||
              'Unknown'
            }`}
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
            <View style={[styles.iconBox, { backgroundColor: colors.cardHover }]}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 14,
                  fontWeight: 'bold',
                }}
              >
                {(item.first_name?.[0] || item.email?.[0] || '?').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>
                {`${item.first_name || ''} ${item.last_name || ''}`.trim() ||
                  'Unknown'}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {item.phone || item.email || 'No contact info'}
              </Text>
            </View>
            {item.total_orders > 0 ? (
              <View style={[styles.qtyBadge, { backgroundColor: `${colors.success}20` }]}>
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
