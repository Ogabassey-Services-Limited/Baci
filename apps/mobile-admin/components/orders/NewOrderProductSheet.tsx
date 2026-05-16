import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppPageSheet } from '@/components/ui/AppPageSheet';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import {
  getProductPickerRowSubtitle,
  getProductPickerRowTitle,
} from '@/lib/order-product-picker';
import { NewOrderProductSheetEmptyState } from './NewOrderProductSheetEmptyState';
import { MODAL_FLATLIST_PROPS } from './new-order.shared';
import { styles } from './new-order.styles';

interface NewOrderProductSheetProps {
  controller: ReturnType<typeof useNewOrderController>;
}

export function NewOrderProductSheet({
  controller,
}: NewOrderProductSheetProps) {
  const {
    closeProductModal,
    colors,
    fetchMoreProducts,
    formatPrice,
    handleAddProduct,
    handleSelectProduct,
    hasMoreProducts,
    isFetchingMoreProducts,
    isPickingVariant,
    productSearch,
    resetProductPickerState,
    selectableProductRows,
    selectedParentProduct,
    setProductSearch,
    showProductModal,
  } = controller;

  return (
    <AppPageSheet
      closeLabel="Close product sheet"
      contentContainerStyle={{ flex: 1, paddingHorizontal: 0, paddingTop: 0 }}
      onClose={closeProductModal}
      scrollEnabled={false}
      title={isPickingVariant ? 'Choose Variant' : 'Select Item'}
      trailingAccessory={
        isPickingVariant ? (
          <Pressable
            accessibilityLabel="Back to product list"
            accessibilityRole="button"
            onPress={resetProductPickerState}
          >
            <Ionicons color={colors.text} name="chevron-back" size={22} />
          </Pressable>
        ) : null
      }
      visible={showProductModal}
    >
      <View style={{ flex: 1 }}>
        {selectedParentProduct ? (
          <Text
            numberOfLines={1}
            style={{
              color: colors.textSecondary,
              fontSize: 12,
              marginBottom: 12,
              paddingHorizontal: 16,
            }}
          >
            {selectedParentProduct.name}
          </Text>
        ) : null}

        {!isPickingVariant ? (
          <>
            <View
              style={[styles.searchBox, { backgroundColor: colors.cardHover }]}
            >
              <Ionicons color={colors.textMuted} name="search" size={20} />
              <TextInput
                accessibilityHint="Type to filter the product list"
                accessibilityLabel="Search products"
                onChangeText={setProductSearch}
                placeholder="Search products..."
                placeholderTextColor={colors.textMuted}
                style={{ color: colors.text, flex: 1, marginLeft: 8 }}
                value={productSearch}
              />
            </View>

            <Pressable
              accessibilityLabel="Create new product"
              accessibilityRole="button"
              onPress={() => {
                closeProductModal();
                router.push('/product/new');
              }}
              style={{
                alignItems: 'center',
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
                flexDirection: 'row',
                padding: 16,
              }}
            >
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: `${colors.primary}20` },
                ]}
              >
                <Ionicons color={colors.primary} name="add" size={20} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                >
                  Create New Product
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Add a new item to inventory
                </Text>
              </View>
            </Pressable>
          </>
        ) : null}

        <FlatList
          // ⚡ Bolt Performance Optimization: Explicit getItemLayout avoids asynchronous measurement cycles on the UI thread
          getItemLayout={(data, index) => ({
            length: 72,
            offset: 72 * index,
            index,
          })}
          {...MODAL_FLATLIST_PROPS}
          data={selectableProductRows}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <NewOrderProductSheetEmptyState controller={controller} />
          }
          ListFooterComponent={
            !isPickingVariant && isFetchingMoreProducts ? (
              <ActivityIndicator
                color={colors.primary}
                size="small"
                style={{ paddingVertical: 16 }}
              />
            ) : null
          }
          onEndReached={() => {
            if (
              !isPickingVariant &&
              hasMoreProducts &&
              !isFetchingMoreProducts
            ) {
              void fetchMoreProducts();
            }
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => {
            const pickerTitle = getProductPickerRowTitle(
              item,
              selectedParentProduct?.name
            );
            const pickerSubtitle = getProductPickerRowSubtitle(item);

            return (
              <Pressable
                accessibilityLabel={
                  isPickingVariant
                    ? `Add ${pickerTitle}`
                    : `Select ${pickerTitle}`
                }
                accessibilityRole="button"
                onPress={() =>
                  isPickingVariant
                    ? handleAddProduct({
                        ...item,
                        images:
                          item.images?.length > 0
                            ? item.images
                            : (selectedParentProduct?.images ?? []),
                      })
                    : handleSelectProduct(item)
                }
                style={[
                  styles.productItem,
                  { borderBottomColor: colors.border, height: 72 },
                ]}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.text, fontSize: 16 }}
                  >
                    {pickerTitle}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.textSecondary, fontSize: 12 }}
                  >
                    {pickerSubtitle}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: '500' }}>
                  {formatPrice(item.price)}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>
    </AppPageSheet>
  );
}
